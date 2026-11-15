package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.*;

import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.budgetmanager.bm.support.IntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.support.TransactionTemplate;

class CardBillIntegrationTest extends IntegrationTest {
  @Autowired private CardService cards;
  @Autowired private CategoryService categories;
  @Autowired private TransactionService transactions;
  @Autowired private StatementImportService imports;
  @Autowired private TransactionRepository repository;
  @Autowired private TransactionTemplate template;
  private Card card;
  private Category category;

  @BeforeEach
  void setUp() {
    signIn(registerUser());
    card = cards.save(null, "Visa", 25, 5);
    category = categories.findByTransactionType(TransactionType.EXPENSE).getFirst();
  }

  @Test
  void manualSaveComputesBillAndListingUsesBillMonthIncludingTheCountQuery() {
    Transaction draft = draft(null);
    draft.setCard(card);
    draft.setPaymentMethod(PaymentMethod.CREDIT_CARD);
    draft.setBillDueDate(LocalDate.of(2000, 1, 1));
    Transaction saved = transactions.save(draft, category.getId());
    assertThat(saved.getBillDueDate()).isEqualTo(LocalDate.of(2027, 1, 5));
    Transaction second = draft(null);
    second.setCard(card);
    second.setPaymentMethod(PaymentMethod.CREDIT_CARD);
    transactions.save(second, category.getId());
    var december = list(2026, 12);
    var january = list(2027, 1);
    assertThat(december.getTotalElements()).isZero();
    assertThat(january.getTotalElements()).isEqualTo(2);
    assertThat(january.getContent().getFirst().getDate()).isEqualTo(LocalDate.of(2026, 12, 12));
    draft.setId(saved.getId());
    draft.setCard(null);
    draft.setPaymentMethod(null);
    assertThat(transactions.update(draft, category.getId()).getBillDueDate()).isNull();
    assertThat(list(2026, 12).getTotalElements()).isEqualTo(1);
  }

  @Test
  void rejectsMonthlyCardAndAnotherOwnersCard() {
    Transaction draft = draft(null);
    draft.setCard(card);
    draft.setPaymentMethod(PaymentMethod.CREDIT_CARD);
    draft.setRepeats(RepeatInterval.MONTHLY);
    assertThatThrownBy(() -> transactions.save(draft, category.getId()))
        .isInstanceOf(ApplicationException.class);
    signIn(registerUser());
    UUID otherCategory =
        categories.findByTransactionType(TransactionType.EXPENSE).getFirst().getId();
    draft.setRepeats(RepeatInterval.NONE);
    assertThatThrownBy(() -> transactions.save(draft, otherCategory))
        .isInstanceOf(ApplicationException.class);
  }

  @Test
  void importPlacesTheChargedInstallmentInThisBillAndReimportDoesNotDuplicate() {
    var line = line(2, false);
    var result = imports.importLines(List.of(line), card.getId(), LocalDate.of(2027, 2, 5));
    assertThat(result.imported()).isEqualTo(1);
    Transaction saved = list(2027, 2).getContent().getFirst();
    assertThat(saved.getBillDueDate()).isEqualTo(LocalDate.of(2027, 1, 5));
    assertThat(saved.getInstallments())
        .extracting(Installment::getDueDate)
        .containsExactlyInAnyOrder(
            LocalDate.of(2027, 1, 5), LocalDate.of(2027, 2, 5), LocalDate.of(2027, 3, 5));
    var reimport = imports.importLines(List.of(line), card.getId(), LocalDate.of(2027, 2, 5));
    assertThat(reimport.imported()).isZero();
    assertThat(reimport.skippedAsDuplicates()).isEqualTo(1);
    assertThat(reimport.billDatesSet()).isZero();
  }

  @Test
  void reimportEnrichesOldPurchaseAndPreservesPaidEarlyInstallments() {
    Transaction saved = transactions.save(draft(3), category.getId());
    transactions.payInstallmentsEarly(saved.getId(), List.of(3), LocalDate.of(2026, 12, 20));
    var result =
        imports.importLines(List.of(line(2, false)), card.getId(), LocalDate.of(2027, 2, 5));
    assertThat(result.imported()).isZero();
    assertThat(result.billDatesSet()).isEqualTo(1);
    Transaction enriched = list(2027, 2).getContent().getFirst();
    assertThat(enriched.getCard().getId()).isEqualTo(card.getId());
    assertThat(enriched.getInstallments())
        .filteredOn(Installment::isPaidEarly)
        .singleElement()
        .satisfies(installment ->
            assertThat(installment.getDueDate()).isEqualTo(LocalDate.of(2026, 12, 20)));
    assertThat(
            imports
                .importLines(List.of(line(2, false)), card.getId(), LocalDate.of(2027, 2, 5))
                .billDatesSet())
        .isZero();
    cards.delete(card.getId());
    template.executeWithoutResult(status -> {
      Transaction retained = repository.findById(saved.getId()).orElseThrow();
      assertThat(retained.getCard()).isNull();
      assertThat(retained.getBillDueDate()).isEqualTo(LocalDate.of(2027, 1, 5));
    });
  }

  @Test
  void reimportMovesAnOldSinglePurchaseToItsBillMonth() {
    Transaction saved = transactions.save(draft(null), category.getId());
    var line =
        new StatementImportService.LineToImport(
            new StatementLine(
                LocalDate.of(2026, 12, 12),
                "Shop",
                new BigDecimal("90.00"),
                false,
                null,
                null,
                null),
            category.getId());
    var result = imports.importLines(List.of(line), null, LocalDate.of(2027, 1, 5));
    assertThat(result.imported()).isZero();
    assertThat(result.billDatesSet()).isEqualTo(1);
    assertThat(list(2026, 12).getTotalElements()).isZero();
    assertThat(list(2027, 1).getContent())
        .extracting(Transaction::getId)
        .containsExactly(saved.getId());
  }

  @Test
  void importWithoutAPrintedBillComputesItFromTheCard() {
    imports.importLines(List.of(line(1, false)), card.getId(), null);
    assertThat(list(2027, 1).getContent().getFirst().getBillDueDate())
        .isEqualTo(LocalDate.of(2027, 1, 5));
  }

  @Test
  void enrichesAPurchaseEvenWhenItsPrepaymentWasAlreadyMoved() {
    Transaction saved = transactions.save(draft(3), category.getId());
    transactions.payInstallmentsEarly(saved.getId(), List.of(3), LocalDate.of(2027, 1, 5));
    var result =
        imports.importLines(List.of(line(3, true)), card.getId(), LocalDate.of(2027, 1, 5));
    assertThat(result.imported()).isZero();
    assertThat(result.movedInstallments()).isZero();
    assertThat(result.billDatesSet()).isEqualTo(1);
  }

  @Test
  void prepaidInstallmentsArePaidOnTheBillDueDate() {
    var result =
        imports.importLines(
            List.of(line(1, false), line(3, true)), card.getId(), LocalDate.of(2027, 1, 5));
    assertThat(result.imported()).isEqualTo(1);
    assertThat(result.movedInstallments()).isEqualTo(1);
    assertThat(list(2027, 1).getContent().getFirst().getInstallments())
        .filteredOn(Installment::isPaidEarly)
        .singleElement()
        .satisfies(installment ->
            assertThat(installment.getDueDate()).isEqualTo(LocalDate.of(2027, 1, 5)));
  }

  private org.springframework.data.domain.Page<Transaction> list(int year, int month) {
    LocalDate start = LocalDate.of(year, month, 1);
    return transactions.findByTransactionTypeAndDateBetween(
        TransactionType.EXPENSE,
        start,
        start.withDayOfMonth(start.lengthOfMonth()),
        "date",
        "asc",
        PageRequest.of(0, 1));
  }

  private Transaction draft(Integer count) {
    return Transaction.builder()
        .date(LocalDate.of(2026, 12, 12))
        .notes("Shop")
        .totalValue(new BigDecimal("90.00"))
        .installmentNumbers(count)
        .repeats(RepeatInterval.NONE)
        .build();
  }

  private StatementImportService.LineToImport line(int number, boolean paidEarly) {
    return new StatementImportService.LineToImport(
        new StatementLine(
            LocalDate.of(2026, 12, 12),
            "Shop",
            new BigDecimal("30.00"),
            false,
            number,
            3,
            null,
            paidEarly),
        category.getId());
  }
}
