package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.RepeatInterval;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Imports bank statements in two steps. {@link #preview} reads a file and marks each line as new or
 * already saved, with a suggested category; nothing is stored. {@link #importLines} saves the lines
 * the user kept, checking duplicates again with the chosen categories, so importing the same
 * statement twice or overlapping statements never double-counts.
 */
@Service
@RequiredArgsConstructor
public class StatementImportService {

  private final StatementReader statementReader;
  private final TransactionRepository transactionRepository;
  private final TransactionService transactionService;
  private final CategoryService categoryService;
  private final UserService userService;

  public record PreviewLine(
      int index,
      StatementLine line,
      UUID suggestedCategoryId,
      UUID duplicateOfTransactionId,
      Integer duplicateOfLine) {

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

  public record ImportResult(int imported, int skippedAsDuplicates) {}

  @Transactional(readOnly = true)
  public Preview preview(byte[] content, String password) {
    ParsedStatement statement = statementReader.read(content, password);
    User user = userService.requireCurrentUser();
    List<ExistingTransaction> existing = transactionRepository.findImportCandidates(user.getId());
    DuplicateMatcher matcher = new DuplicateMatcher(existing);
    Map<String, ExistingTransaction> latestByDescription = latestByDescription(existing);

    List<PreviewLine> lines = new ArrayList<>();
    for (int index = 0; index < statement.lines().size(); index++) {
      StatementLine line = statement.lines().get(index);
      DuplicateMatcher.Match match = matcher.match(index, line, null);
      UUID suggestion =
          match != null && match.categoryId() != null
              ? match.categoryId()
              : suggestCategory(line, latestByDescription);
      lines.add(
          new PreviewLine(
              index,
              line,
              suggestion,
              match == null ? null : match.transactionId(),
              match == null ? null : match.sameAsLine()));
    }
    return new Preview(statement, lines);
  }

  @Transactional
  public ImportResult importLines(List<LineToImport> linesToImport) {
    if (linesToImport == null || linesToImport.isEmpty()) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Select at least one line");
    }
    User user = userService.requireCurrentUser();
    DuplicateMatcher matcher =
        new DuplicateMatcher(transactionRepository.findImportCandidates(user.getId()));

    int imported = 0;
    int skipped = 0;
    for (int index = 0; index < linesToImport.size(); index++) {
      LineToImport lineToImport = linesToImport.get(index);
      StatementLine line = lineToImport.line();
      Category category = categoryService.requireOwned(lineToImport.categoryId(), user);
      TransactionType expected = line.credit() ? TransactionType.INCOME : TransactionType.EXPENSE;
      if (category.getTransactionType() != expected) {
        throw new ApplicationException(
            ApplicationError.BAD_REQUEST,
            "{} needs an {} category",
            line.description(),
            expected.name().toLowerCase(java.util.Locale.ROOT));
      }
      if (matcher.match(index, line, category.getId()) != null) {
        skipped++;
        continue;
      }
      transactionService.save(toTransaction(line), category.getId());
      imported++;
    }
    return new ImportResult(imported, skipped);
  }

  private static Transaction toTransaction(StatementLine line) {
    return Transaction.builder()
        .date(line.date())
        .notes(StatementText.truncate(line.description()))
        .totalValue(line.totalValue())
        .installmentNumbers(line.isInstallment() ? line.installmentTotal() : null)
        .repeats(RepeatInterval.NONE)
        .build();
  }

  /** The category used last time for the same description and kind of transaction. */
  private static UUID suggestCategory(
      StatementLine line, Map<String, ExistingTransaction> latestByDescription) {
    TransactionType type = line.credit() ? TransactionType.INCOME : TransactionType.EXPENSE;
    ExistingTransaction latest =
        latestByDescription.get(type + ":" + StatementText.normalize(line.description()));
    return latest == null ? null : latest.categoryId();
  }

  private static Map<String, ExistingTransaction> latestByDescription(
      List<ExistingTransaction> existing) {
    Map<String, ExistingTransaction> latest = new HashMap<>();
    existing.stream()
        .sorted(Comparator.comparing(ExistingTransaction::date))
        .forEach(transaction ->
            latest.put(
                transaction.transactionType() + ":" + StatementText.normalize(transaction.notes()),
                transaction));
    return latest;
  }
}
