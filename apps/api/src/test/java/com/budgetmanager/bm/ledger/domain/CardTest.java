package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CardTest {
  @ParameterizedTest
  @CsvSource({
    "2026-12-12,25,5,2027-01-05",
    "2026-12-25,25,5,2027-01-05",
    "2026-12-26,25,5,2027-02-05",
    "2026-03-02,3,10,2026-03-10",
    "2026-03-03,3,10,2026-03-10",
    "2026-03-04,3,10,2026-04-10",
    "2026-02-28,31,31,2026-03-31",
    "2028-02-29,31,31,2028-03-31",
    "2028-01-31,31,30,2028-02-29",
    "2026-01-31,31,30,2026-02-28",
    "2026-04-30,30,30,2026-05-30"
  })
  void computesTheFirstDueDayStrictlyAfterClosing(
      String purchase, int closing, int due, String expected) {
    assertThat(Card.billDueDate(LocalDate.parse(purchase), closing, due))
        .isEqualTo(LocalDate.parse(expected));
  }

  @Test
  void schedulesFromFirstBillWithoutMonthEndDriftAndPreservesEarlyPayments() {
    Transaction purchase =
        Transaction.builder()
            .date(LocalDate.of(2027, 12, 12))
            .billDueDate(LocalDate.of(2028, 1, 31))
            .installmentNumbers(3)
            .totalValue(new BigDecimal("90.00"))
            .build();
    purchase.scheduleInstallments();
    assertThat(purchase.getInstallments())
        .extracting(Installment::getDueDate)
        .containsExactly(
            LocalDate.of(2028, 1, 31), LocalDate.of(2028, 2, 29), LocalDate.of(2028, 3, 31));
    purchase.payInstallmentEarly(3, LocalDate.of(2028, 1, 20));
    purchase.assignBillDueDate(LocalDate.of(2028, 2, 29));
    purchase.scheduleInstallments();
    assertThat(purchase.getInstallments())
        .extracting(Installment::getDueDate)
        .containsExactly(
            LocalDate.of(2028, 2, 29), LocalDate.of(2028, 3, 29), LocalDate.of(2028, 1, 20));
    purchase.restoreInstallment(3);
    assertThat(purchase.getInstallments().get(2).getDueDate()).isEqualTo(LocalDate.of(2028, 4, 29));
  }

  @Test
  void rejectsInvalidDays() {
    assertThatIllegalArgumentException()
        .isThrownBy(() -> Card.billDueDate(LocalDate.of(2026, 1, 1), 0, 5));
    assertThatIllegalArgumentException()
        .isThrownBy(() -> Card.billDueDate(LocalDate.of(2026, 1, 1), 25, 32));
  }
}
