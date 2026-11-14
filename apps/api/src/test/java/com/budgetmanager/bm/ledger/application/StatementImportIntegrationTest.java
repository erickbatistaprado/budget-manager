package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.application.StatementImportService.LineToImport;
import com.budgetmanager.bm.ledger.application.StatementImportService.Preview;
import com.budgetmanager.bm.ledger.application.StatementImportService.PreviewLine;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.budgetmanager.bm.support.IntegrationTest;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class StatementImportIntegrationTest extends IntegrationTest {

  private static final String OCTOBER_BILL =
      """
      date,title,amount
      2026-10-05,Corner Market,"50,00"
      2026-10-05,Corner Market,"50,00"
      2026-10-06,Bike Shop - Parcela 1/3,"100,00"
      2026-10-07,"Estorno de \"\"Corner Market\"\"","- 50,00"
      """;

  private static final String NOVEMBER_BILL =
      """
      date,title,amount
      2026-11-06,Bike Shop - Parcela 2/3,"100,00"
      2026-11-08,Bakery,"12,30"
      """;

  @Autowired private StatementImportService importService;
  @Autowired private CategoryService categoryService;
  @Autowired private TransactionRepository transactionRepository;

  private User user;
  private Category groceries;
  private Category leisure;
  private Category refunds;

  @BeforeEach
  void setUp() {
    user = registerUser();
    signIn(user);
    groceries = categoryService.save(category("Market", TransactionType.EXPENSE));
    leisure = categoryService.save(category("Hobbies", TransactionType.EXPENSE));
    refunds = categoryService.save(category("Chargebacks", TransactionType.INCOME));
  }

  @Test
  void previewSelectsNewExpensesAndLeavesCreditsForTheUser() {
    Preview preview = preview(OCTOBER_BILL);

    assertThat(preview.lines()).hasSize(4);
    assertThat(preview.lines())
        .extracting(PreviewLine::selected)
        .containsExactly(true, true, true, false);
    assertThat(preview.lines()).noneMatch(PreviewLine::duplicate);
    assertThat(transactions()).isEmpty();
  }

  @Test
  void importsSelectedLinesWithInstallmentSchedules() {
    StatementImportService.ImportResult result =
        importService.importLines(chosen(preview(OCTOBER_BILL), groceries.getId(), true));

    assertThat(result.imported()).isEqualTo(4);
    Transaction bike =
        transactions().stream()
            .filter(transaction -> "Bike Shop".equals(transaction.getNotes()))
            .findFirst()
            .orElseThrow();
    assertThat(bike.getInstallmentNumbers()).isEqualTo(3);
    assertThat(bike.getTotalValue()).isEqualByComparingTo("300.00");
  }

  @Test
  void importingTheSameStatementTwiceAddsNothing() {
    importService.importLines(chosen(preview(OCTOBER_BILL), groceries.getId(), true));

    Preview again = preview(OCTOBER_BILL);
    StatementImportService.ImportResult result =
        importService.importLines(chosen(again, groceries.getId(), true));

    assertThat(again.lines()).allMatch(PreviewLine::duplicate);
    assertThat(result.imported()).isZero();
    assertThat(result.skippedAsDuplicates()).isEqualTo(4);
    assertThat(transactions()).hasSize(4);
  }

  @Test
  void identicalLinesAreCountedNotCollapsed() {
    String oneCharge =
        """
        date,title,amount
        2026-10-05,Corner Market,"50,00"
        """;
    importService.importLines(chosen(preview(oneCharge), groceries.getId(), false));

    Preview twoCharges = preview(OCTOBER_BILL);

    assertThat(twoCharges.lines().get(0).duplicate()).isTrue();
    assertThat(twoCharges.lines().get(1).duplicate()).isFalse();
  }

  @Test
  void theNextBillsInstallmentIsRecognizedAsTheSamePurchase() {
    importService.importLines(chosen(preview(OCTOBER_BILL), groceries.getId(), false));

    Preview november = preview(NOVEMBER_BILL);
    StatementImportService.ImportResult result =
        importService.importLines(chosen(november, groceries.getId(), false));

    assertThat(november.lines().get(0).duplicate()).isTrue();
    assertThat(november.lines().get(0).suggestedCategoryId()).isEqualTo(groceries.getId());
    assertThat(result.imported()).isEqualTo(1);
    assertThat(transactions())
        .filteredOn(transaction -> "Bike Shop".equals(transaction.getNotes()))
        .hasSize(1);
  }

  @Test
  void aDifferentCategoryIsNotADuplicate() {
    importService.importLines(chosen(preview(NOVEMBER_BILL), groceries.getId(), false));

    StatementImportService.ImportResult result =
        importService.importLines(chosen(preview(NOVEMBER_BILL), leisure.getId(), false));

    assertThat(result.imported()).isEqualTo(2);
  }

  @Test
  void suggestsTheCategoryUsedBeforeForTheSameDescription() {
    importService.importLines(chosen(preview(NOVEMBER_BILL), leisure.getId(), false));
    String laterBakery =
        """
        date,title,amount
        2026-12-01,BAKERY,"9,90"
        """;

    PreviewLine bakery = preview(laterBakery).lines().getFirst();

    assertThat(bakery.duplicate()).isFalse();
    assertThat(bakery.suggestedCategoryId()).isEqualTo(leisure.getId());
  }

  @Test
  void creditsNeedAnIncomeCategory() {
    PreviewLine refund = preview(OCTOBER_BILL).lines().get(3);

    assertThatThrownBy(() ->
            importService.importLines(List.of(new LineToImport(refund.line(), groceries.getId()))))
        .isInstanceOf(ApplicationException.class);
    assertThat(
            importService
                .importLines(List.of(new LineToImport(refund.line(), refunds.getId())))
                .imported())
        .isEqualTo(1);
  }

  @Test
  void otherUsersTransactionsNeverCountAsDuplicates() {
    importService.importLines(chosen(preview(NOVEMBER_BILL), groceries.getId(), false));

    User other = registerUser();
    signIn(other);
    categoryService.save(category("Market", TransactionType.EXPENSE));

    assertThat(preview(NOVEMBER_BILL).lines()).noneMatch(PreviewLine::duplicate);
  }

  private Preview preview(String csv) {
    return importService.preview(csv.getBytes(StandardCharsets.UTF_8), null);
  }

  /** Every line of the preview, credits only when asked, with the given expense category. */
  private List<LineToImport> chosen(Preview preview, UUID expenseCategory, boolean withCredits) {
    return preview.lines().stream()
        .filter(previewLine -> withCredits || !previewLine.line().credit())
        .map(previewLine ->
            new LineToImport(
                previewLine.line(),
                previewLine.line().credit() ? refunds.getId() : expenseCategory))
        .toList();
  }

  private List<Transaction> transactions() {
    List<UUID> ids =
        transactionRepository.findImportCandidates(user.getId()).stream()
            .map(ExistingTransaction::id)
            .toList();
    return ids.isEmpty()
        ? List.of()
        : transactionRepository.findAllWithCategoryAndInstallmentsByIdIn(ids);
  }

  private static Category category(String name, TransactionType type) {
    return Category.builder().name(name).transactionType(type).build();
  }
}
