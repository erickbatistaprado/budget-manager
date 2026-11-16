package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.ledger.domain.statement.*;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class StatementImportServiceTest {
  private final TransactionRepository repository = mock(TransactionRepository.class);
  private final UserService users = mock(UserService.class);
  private final CategoryService categories = mock(CategoryService.class);
  private final CardService cards = mock(CardService.class);
  private final TransactionService transactions = mock(TransactionService.class);
  private final StatementReader reader = mock(StatementReader.class);
  private final StatementImportService service =
      new StatementImportService(reader, repository, transactions, categories, users, cards);
  private final User owner = User.builder().id(UUID.randomUUID()).build();
  private final Category category =
      Category.builder().id(UUID.randomUUID()).transactionType(TransactionType.EXPENSE).build();
  private final Card card = Card.builder().id(UUID.randomUUID()).closingDay(25).dueDay(5).build();
  private static final LocalDate BILL = LocalDate.of(2026, 12, 5);

  @BeforeEach
  void setUp() {
    when(users.requireCurrentUser()).thenReturn(owner);
    when(categories.requireOwned(category.getId(), owner)).thenReturn(category);
    when(cards.requireOwned(card.getId(), owner)).thenReturn(card);
  }

  private Transaction purchase() {
    Transaction purchase =
        Transaction.builder()
            .id(UUID.randomUUID())
            .user(owner)
            .category(category)
            .notes("Shop")
            .date(BILL.minusMonths(2))
            .installmentNumbers(3)
            .totalValue(new BigDecimal("1516.00"))
            .build();
    purchase.scheduleInstallments();
    when(repository.findMoneyFlowData(owner.getId())).thenReturn(List.of(purchase));
    when(repository.findImportCandidates(owner.getId()))
        .thenReturn(
            List.of(
                new ExistingTransaction(
                    purchase.getId(),
                    purchase.getNotes(),
                    purchase.getDate(),
                    purchase.getTotalValue(),
                    3,
                    category.getId(),
                    TransactionType.EXPENSE,
                    null)));
    when(repository.findByIdAndUserId(purchase.getId(), owner.getId()))
        .thenReturn(Optional.of(purchase));
    return purchase;
  }

  private StatementImportService.ImportResult importAmount(String amount) {
    return service.importLines(
        List.of(
            new StatementImportService.LineToImport(
                new StatementLine(
                    BILL.minusMonths(2), "Shop", new BigDecimal(amount), false, 3, 3, null),
                category.getId())),
        card.getId(),
        BILL);
  }

  @Test
  void adjustsOnlyTheMatchedUnpaidInstallmentAndReportsIt() {
    Transaction purchase = purchase();
    assertThat(importAmount("505.33").installmentAmountsAdjusted()).isEqualTo(1);
    assertThat(purchase.getTotalValue()).isEqualByComparingTo("1515.99");
    assertThat(importAmount("505.33").installmentAmountsAdjusted()).isZero();
    verifyNoInteractions(transactions);
  }

  @Test
  void leavesPaidEarlyAndFinancingAmountsAlone() {
    Transaction purchase = purchase();
    purchase.payInstallmentEarly(3, BILL.minusMonths(2));
    assertThat(importAmount("505.33").installmentAmountsAdjusted()).isZero();
    purchase.restoreInstallment(3);
    purchase.setFinancingId(UUID.randomUUID());
    assertThat(importAmount("505.33").installmentAmountsAdjusted()).isZero();
    assertThat(purchase.getTotalValue()).isEqualByComparingTo("1516.00");
  }

  @Test
  void previewsSubscriptionDuplicateAndUpdatesOnlyWithExplicitConfirmation() {
    Transaction series =
        Transaction.builder()
            .id(UUID.randomUUID())
            .card(card)
            .category(category)
            .date(BILL.minusMonths(3))
            .repeats(RepeatInterval.MONTHLY)
            .notes("Streaming subscription")
            .totalValue(new BigDecimal("30"))
            .build();
    when(repository.findCardSubscriptions(owner.getId())).thenReturn(List.of(series));
    StatementLine line =
        new StatementLine(
            BILL.minusDays(10),
            "Streaming subscription",
            new BigDecimal("45"),
            false,
            null,
            null,
            null);
    byte[] file = new byte[0];
    when(reader.read(file, null, "bill.csv"))
        .thenReturn(
            new ParsedStatement(StatementSource.NUBANK_CARD_CSV, List.of(line), null, null, BILL));
    var preview = service.preview(file, null, "bill.csv", card.getId(), BILL).lines().getFirst();
    assertThat(preview.duplicate()).isTrue();
    assertThat(preview.selected()).isFalse();
    assertThat(preview.updateMonthAvailable()).isTrue();
    var unchanged =
        service.importLines(
            List.of(new StatementImportService.LineToImport(line, category.getId())),
            card.getId(),
            BILL);
    assertThat(unchanged.skippedAsDuplicates()).isEqualTo(1);
    assertThat(series.amountIn(YearMonth.from(BILL))).isEqualByComparingTo("30");
    service.importLines(
        List.of(new StatementImportService.LineToImport(line, category.getId(), true)),
        card.getId(),
        BILL);
    assertThat(series.amountIn(YearMonth.from(BILL))).isEqualByComparingTo("45");
    assertThat(series.amountIn(YearMonth.from(BILL).plusMonths(1))).isEqualByComparingTo("30");
    verifyNoInteractions(transactions);
  }
}
