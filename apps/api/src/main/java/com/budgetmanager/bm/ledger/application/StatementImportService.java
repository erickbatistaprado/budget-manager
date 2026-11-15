package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.RepeatInterval;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.domain.statement.MerchantText;
import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Imports bank statements in two steps. {@link #preview} reads a file and marks each line as new or
 * already saved, with a suggested category; nothing is stored. {@link #importLines} saves the lines
 * the user kept, checking duplicates again with the chosen categories, so importing the same
 * statement twice or overlapping statements never double-counts.
 *
 * <p>A prepaid installment ({@code "Antecipada - Shop - Parcela 7/8"}) adds no expense: it moves
 * that installment of the purchase to the day it was paid. The purchase is the saved one, the one
 * another line of the same statement creates, or, when neither exists, one the prepaid line
 * creates.
 */
@Service
@RequiredArgsConstructor
public class StatementImportService {

  private final StatementReader statementReader;
  private final TransactionRepository transactionRepository;
  private final TransactionService transactionService;
  private final CategoryService categoryService;
  private final UserService userService;

  /** Where a suggested category comes from, strongest first. */
  public enum SuggestionSource {
    /** The line is already saved; this is the category it was saved with. */
    DUPLICATE,
    /** A prepaid installment of a saved purchase; this is the purchase's category. */
    PURCHASE,
    EXACT,
    MERCHANT,
    KEYWORD,
    SIMILAR
  }

  /**
   * @param suggestionBasis the saved description or the keyword behind the suggestion
   * @param suggestionCount how many saved transactions back it (0 for keywords)
   * @param merchantKey lines with the same key are the same merchant
   * @param samePurchaseAsLine for a prepaid installment, the line of this statement that creates
   *     its purchase
   * @param samePurchaseAsTransactionId for a prepaid installment, the saved purchase it moves
   */
  public record PreviewLine(
      int index,
      StatementLine line,
      UUID suggestedCategoryId,
      SuggestionSource suggestionSource,
      String suggestionBasis,
      int suggestionCount,
      String merchantKey,
      UUID duplicateOfTransactionId,
      Integer duplicateOfLine,
      Integer samePurchaseAsLine,
      UUID samePurchaseAsTransactionId) {

    public boolean duplicate() {
      return duplicateOfTransactionId != null || duplicateOfLine != null;
    }

    /** Expenses that are not yet saved start selected; credits are left for the user to pick. */
    public boolean selected() {
      return !duplicate() && !line.credit();
    }
  }

  public record Preview(ParsedStatement statement, List<PreviewLine> lines) {

    public Preview {
      lines = List.copyOf(lines);
    }
  }

  public record LineToImport(StatementLine line, UUID categoryId) {}

  public record ImportResult(int imported, int skippedAsDuplicates, int movedInstallments) {}

  @Transactional(readOnly = true)
  public Preview preview(byte[] content, String password) {
    ParsedStatement statement = statementReader.read(content, password);
    User user = userService.requireCurrentUser();
    List<ExistingTransaction> existing = transactionRepository.findImportCandidates(user.getId());
    DuplicateMatcher matcher = new DuplicateMatcher(existing);
    Set<String> alreadyMoved = alreadyMoved(user);
    List<Category> categories = new ArrayList<>();
    categories.addAll(categoryService.findByTransactionType(TransactionType.EXPENSE));
    categories.addAll(categoryService.findByTransactionType(TransactionType.INCOME));
    CategorySuggester suggester = new CategorySuggester(existing, categories);

    List<StatementLine> statementLines = statement.lines();
    PreviewLine[] lines = new PreviewLine[statementLines.size()];
    Map<Object, Integer> purchaseCreatedByLine = new HashMap<>();

    for (int index = 0; index < statementLines.size(); index++) {
      StatementLine line = statementLines.get(index);
      if (line.paidEarly()) {
        continue;
      }
      DuplicateMatcher.Match match = matcher.match(index, line, null);
      if (match != null && match.categoryId() != null) {
        lines[index] =
            new PreviewLine(
                index,
                line,
                match.categoryId(),
                SuggestionSource.DUPLICATE,
                null,
                0,
                MerchantText.merchantKey(line.description()),
                match.transactionId(),
                match.sameAsLine(),
                null,
                null);
        continue;
      }
      lines[index] = suggested(index, line, suggester, match);
      if (line.isInstallment() && match == null) {
        purchaseCreatedByLine.putIfAbsent(DuplicateMatcher.purchaseKey(line), index);
      }
    }

    for (int index = 0; index < statementLines.size(); index++) {
      StatementLine line = statementLines.get(index);
      if (line.paidEarly()) {
        lines[index] =
            prepaidLine(
                index, line, matcher, alreadyMoved, purchaseCreatedByLine, lines, suggester);
      }
    }
    return new Preview(statement, Arrays.asList(lines));
  }

  @Transactional
  public ImportResult importLines(List<LineToImport> linesToImport) {
    if (linesToImport == null || linesToImport.isEmpty()) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Select at least one line");
    }
    User user = userService.requireCurrentUser();
    DuplicateMatcher matcher =
        new DuplicateMatcher(transactionRepository.findImportCandidates(user.getId()));
    Set<String> alreadyMoved = alreadyMoved(user);
    Map<Object, UUID> purchasesCreated = new HashMap<>();

    int imported = 0;
    int skipped = 0;
    int moved = 0;
    for (int index = 0; index < linesToImport.size(); index++) {
      LineToImport lineToImport = linesToImport.get(index);
      StatementLine line = lineToImport.line();
      Category category = requireCategoryFor(line, lineToImport.categoryId(), user);
      if (line.paidEarly()) {
        continue;
      }
      if (matcher.match(index, line, category.getId()) != null) {
        skipped++;
        continue;
      }
      Transaction saved =
          transactionService.save(toTransaction(line, line.date()), category.getId());
      imported++;
      if (line.isInstallment()) {
        purchasesCreated.putIfAbsent(DuplicateMatcher.purchaseKey(line), saved.getId());
      }
    }

    for (LineToImport lineToImport : linesToImport) {
      StatementLine line = lineToImport.line();
      if (!line.paidEarly()) {
        continue;
      }
      Object purchaseKey = DuplicateMatcher.purchaseKey(line);
      UUID purchaseId =
          Optional.ofNullable(purchasesCreated.get(purchaseKey))
              .or(() -> matcher.findPurchase(line).map(ExistingTransaction::id))
              .orElse(null);
      if (purchaseId == null) {
        LocalDate firstInstallment = line.date().minusMonths(line.installmentNumber() - 1L);
        purchaseId =
            transactionService
                .save(toTransaction(line, firstInstallment), lineToImport.categoryId())
                .getId();
        purchasesCreated.put(purchaseKey, purchaseId);
        imported++;
      }
      String movedKey = movedKey(purchaseId, line.installmentNumber(), line.date());
      if (alreadyMoved.contains(movedKey)) {
        skipped++;
        continue;
      }
      Transaction purchase =
          transactionRepository.findByIdAndUserId(purchaseId, user.getId()).orElseThrow();
      if (!canPayEarly(purchase, line)) {
        // The saved schedule disagrees with the statement, for instance the installment is due
        // before the prepayment date; leave it where it is rather than failing the whole import.
        skipped++;
        continue;
      }
      purchase.payInstallmentEarly(line.installmentNumber(), line.date());
      transactionRepository.save(purchase);
      alreadyMoved.add(movedKey);
      moved++;
    }
    return new ImportResult(imported, skipped, moved);
  }

  private static boolean canPayEarly(Transaction purchase, StatementLine line) {
    int number = line.installmentNumber();
    return purchase.getInstallmentNumbers() != null
        && number <= purchase.getInstallmentNumbers()
        && !line.date().isAfter(purchase.scheduledDueDate(number));
  }

  private PreviewLine suggested(
      int index, StatementLine line, CategorySuggester suggester, DuplicateMatcher.Match match) {
    CategorySuggester.Suggestion suggestion = suggester.suggest(line).orElse(null);
    return new PreviewLine(
        index,
        line,
        suggestion == null ? null : suggestion.categoryId(),
        suggestion == null ? null : SuggestionSource.valueOf(suggestion.source().name()),
        suggestion == null ? null : suggestion.basis(),
        suggestion == null ? 0 : suggestion.count(),
        MerchantText.merchantKey(line.description()),
        match == null ? null : match.transactionId(),
        match == null ? null : match.sameAsLine(),
        null,
        null);
  }

  private static PreviewLine prepaidLine(
      int index,
      StatementLine line,
      DuplicateMatcher matcher,
      Set<String> alreadyMoved,
      Map<Object, Integer> purchaseCreatedByLine,
      PreviewLine[] lines,
      CategorySuggester suggester) {
    String merchantKey = MerchantText.merchantKey(line.description());
    Optional<ExistingTransaction> purchase = matcher.findPurchase(line);
    if (purchase.isPresent()) {
      ExistingTransaction saved = purchase.get();
      boolean moved =
          alreadyMoved.contains(movedKey(saved.id(), line.installmentNumber(), line.date()));
      return new PreviewLine(
          index,
          line,
          saved.categoryId(),
          SuggestionSource.PURCHASE,
          saved.notes(),
          0,
          merchantKey,
          moved ? saved.id() : null,
          null,
          null,
          saved.id());
    }
    Object purchaseKey = DuplicateMatcher.purchaseKey(line);
    Integer creator = purchaseCreatedByLine.get(purchaseKey);
    if (creator != null) {
      PreviewLine creatorLine = lines[creator];
      return new PreviewLine(
          index,
          line,
          creatorLine.suggestedCategoryId(),
          creatorLine.suggestionSource(),
          creatorLine.suggestionBasis(),
          creatorLine.suggestionCount(),
          merchantKey,
          null,
          null,
          creator,
          null);
    }
    purchaseCreatedByLine.put(purchaseKey, index);
    CategorySuggester.Suggestion suggestion = suggester.suggest(line).orElse(null);
    return new PreviewLine(
        index,
        line,
        suggestion == null ? null : suggestion.categoryId(),
        suggestion == null ? null : SuggestionSource.valueOf(suggestion.source().name()),
        suggestion == null ? null : suggestion.basis(),
        suggestion == null ? 0 : suggestion.count(),
        merchantKey,
        null,
        null,
        null,
        null);
  }

  private Category requireCategoryFor(StatementLine line, UUID categoryId, User user) {
    Category category = categoryService.requireOwned(categoryId, user);
    TransactionType expected = line.credit() ? TransactionType.INCOME : TransactionType.EXPENSE;
    if (category.getTransactionType() != expected) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST,
          "{} needs an {} category",
          line.description(),
          expected.name().toLowerCase(Locale.ROOT));
    }
    return category;
  }

  private Set<String> alreadyMoved(User user) {
    Set<String> moved = new HashSet<>();
    for (PaidEarlyInstallment installment :
        transactionRepository.findPaidEarlyInstallments(user.getId())) {
      moved.add(
          movedKey(
              installment.transactionId(), installment.installmentNumber(), installment.paidOn()));
    }
    return moved;
  }

  private static String movedKey(UUID transactionId, int installmentNumber, LocalDate paidOn) {
    return transactionId + ":" + installmentNumber + ":" + paidOn;
  }

  private static Transaction toTransaction(StatementLine line, LocalDate date) {
    return Transaction.builder()
        .date(date)
        .notes(StatementText.truncate(line.description()))
        .totalValue(line.totalValue())
        .installmentNumbers(line.isInstallment() ? line.installmentTotal() : null)
        .repeats(RepeatInterval.NONE)
        .build();
  }
}
