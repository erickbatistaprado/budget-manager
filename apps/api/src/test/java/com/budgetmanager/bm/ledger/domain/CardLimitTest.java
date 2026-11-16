package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CardLimitTest {
  private final LocalDate today = LocalDate.of(2026, 11, 15);
  private final Card card =
      Card.builder().id(UUID.randomUUID()).creditLimit(new BigDecimal("500")).build();

  @Test
  void reservesAllFutureInstallmentsAndSubtractsCreditsInUnpaidBills() {
    Transaction purchase =
        Transaction.builder()
            .card(card)
            .category(Category.builder().transactionType(TransactionType.EXPENSE).build())
            .installments(
                List.of(
                    Installment.builder()
                        .dueDate(today.minusMonths(1))
                        .amount(new BigDecimal("200"))
                        .build(),
                    Installment.builder()
                        .dueDate(today.plusMonths(1))
                        .amount(new BigDecimal("200"))
                        .build(),
                    Installment.builder()
                        .dueDate(today.plusMonths(2))
                        .amount(new BigDecimal("200"))
                        .build()))
            .build();
    var entries = new java.util.ArrayList<>(TransactionOccurrence.expand(purchase, LocalDate.MAX));
    entries.add(
        new TransactionOccurrence(
            today.plusMonths(1),
            new BigDecimal("25"),
            TransactionType.INCOME,
            null,
            card.getId(),
            PaymentMethod.CREDIT_CARD));
    var result =
        CardLimit.calculate(card, MoneyFlow.bills(entries, List.of(card)), List.of(), today);
    assertThat(result.usedLimit()).isEqualByComparingTo("575");
    assertThat(result.availableLimit()).isEqualByComparingTo("-75");
  }

  @Test
  void onlyPastBillsWithRecordedOrAutomaticPaymentsReleaseTheLimit() {
    var past = new MoneyFlow.Bill(card, today.minusDays(1), new BigDecimal("100"));
    var dueToday = new MoneyFlow.Bill(card, today, new BigDecimal("50"));
    var future = new MoneyFlow.Bill(card, today.plusMonths(1), new BigDecimal("75"));
    for (boolean automatic : List.of(false, true)) {
      var payment =
          Movement.builder()
              .kind(MovementKind.CARD_BILL_PAYMENT)
              .cardId(card.getId())
              .billDueDate(past.dueDate())
              .automatic(automatic)
              .build();
      var result = CardLimit.calculate(card, List.of(past, future), List.of(payment), today);
      assertThat(result.usedLimit()).isEqualByComparingTo("75");
      assertThat(result.availableLimit()).isEqualByComparingTo("425");
      assertThat(CardLimit.calculate(card, List.of(dueToday), List.of(payment), today).usedLimit())
          .isEqualByComparingTo("50");
    }
    var funding =
        Movement.builder()
            .kind(MovementKind.TRANSFER)
            .cardId(card.getId())
            .billDueDate(past.dueDate())
            .build();
    assertThat(CardLimit.calculate(card, List.of(past), List.of(funding), today).usedLimit())
        .isEqualByComparingTo("100");
    var other =
        Movement.builder()
            .kind(MovementKind.CARD_BILL_PAYMENT)
            .cardId(UUID.randomUUID())
            .billDueDate(past.dueDate())
            .build();
    assertThat(CardLimit.calculate(card, List.of(past), List.of(other), today).usedLimit())
        .isEqualByComparingTo("100");
  }

  @Test
  void missingLimitHasNoUsageOrAvailabilityAndNoPurchasesMeansAllAvailable() {
    var empty = CardLimit.calculate(card, List.of(), List.of(), today);
    assertThat(empty.usedLimit()).isZero();
    assertThat(empty.availableLimit()).isEqualByComparingTo("500");
    card.setCreditLimit(null);
    var result = CardLimit.calculate(card, List.of(), List.of(), today);
    assertThat(result.creditLimit()).isNull();
    assertThat(result.usedLimit()).isNull();
    assertThat(result.availableLimit()).isNull();
  }
}
