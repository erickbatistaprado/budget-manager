package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.*;

import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.support.IntegrationTest;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

class LedgerImportImprovementsIntegrationTest extends IntegrationTest {
  @Autowired private StatementImportService imports;
  @Autowired private TransactionService transactions;
  @Autowired private TransactionRepository repository;
  @Autowired private CardService cards;
  @Autowired private CategoryService categories;
  @Autowired private TransactionTemplate template;
  private Card card;
  private Category category;
  private static final LocalDate BILL = LocalDate.of(2026, 12, 5);

  @BeforeEach
  void setUp() {
    signIn(registerUser());
    card = cards.save(null, "Visa", 25, 5);
    category = categories.findByTransactionType(TransactionType.EXPENSE).getFirst();
  }

  private Transaction draft(String notes) {
    return Transaction.builder()
        .card(card)
        .paymentMethod(PaymentMethod.CREDIT_CARD)
        .date(LocalDate.of(2026, 1, 5))
        .notes(notes)
        .repeats(RepeatInterval.NONE)
        .totalValue(new BigDecimal("1516.00"))
        .build();
  }

  @Test
  void installmentRoundingIsPersistedWithItsTotalAndReimportIsIdempotent() {
    Transaction draft = draft("Bike shop");
    draft.setInstallmentNumbers(3);
    var saved = transactions.save(draft, category.getId());
    var line =
        new StatementImportService.LineToImport(
            new StatementLine(
                draft.getDate(), "Bike shop", new BigDecimal("505.33"), false, 3, 3, null),
            category.getId());
    assertThat(imports.importLines(List.of(line), card.getId(), BILL).installmentAmountsAdjusted())
        .isEqualTo(1);
    template.executeWithoutResult(status -> {
      Transaction loaded = repository.findById(saved.getId()).orElseThrow();
      assertThat(loaded.getTotalValue()).isEqualByComparingTo("1515.99");
      assertThat(
              loaded.getInstallments().stream()
                  .map(Installment::getAmount)
                  .reduce(BigDecimal.ZERO, BigDecimal::add))
          .isEqualByComparingTo(loaded.getTotalValue());
      assertThat(loaded.getInstallments().getLast().getAmount()).isEqualByComparingTo("505.33");
    });
    assertThat(imports.importLines(List.of(line), card.getId(), BILL).installmentAmountsAdjusted())
        .isZero();
  }

  @Test
  void subscriptionPreviewAndConfirmationUpdateOnlyTheBillMonth() {
    Transaction draft = draft("Streaming subscription");
    draft.setRepeats(RepeatInterval.MONTHLY);
    draft.setTotalValue(new BigDecimal("30"));
    var saved = transactions.save(draft, category.getId());
    byte[] file =
        "date,title,amount\n2026-11-15,Streaming subscription,\"45,00\"\n"
            .getBytes(StandardCharsets.UTF_8);
    var preview = imports.preview(file, null, "bill.csv", card.getId(), BILL).lines().getFirst();
    assertThat(preview.duplicate()).isTrue();
    assertThat(preview.selected()).isFalse();
    assertThat(preview.subscriptionName()).isEqualTo(draft.getNotes());
    assertThat(preview.updateMonthAvailable()).isTrue();
    var line = new StatementImportService.LineToImport(preview.line(), category.getId());
    assertThat(imports.importLines(List.of(line), card.getId(), BILL).imported()).isZero();
    imports.importLines(
        List.of(new StatementImportService.LineToImport(preview.line(), category.getId(), true)),
        card.getId(),
        BILL);
    template.executeWithoutResult(status -> {
      Transaction loaded = repository.findById(saved.getId()).orElseThrow();
      assertThat(loaded.amountIn(YearMonth.from(BILL))).isEqualByComparingTo("45");
      assertThat(loaded.amountIn(YearMonth.from(BILL).plusMonths(1))).isEqualByComparingTo("30");
    });
    assertThat(
            imports
                .preview(file, null, "bill.csv", card.getId(), BILL)
                .lines()
                .getFirst()
                .updateMonthAvailable())
        .isFalse();
  }
}
