package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;

class MonthlyTransactionTest {
  private static final YearMonth DECEMBER = YearMonth.of(2026, 12);

  @Test
  void overridesAreUniqueAndNeverChangeOtherMonths() {
    Transaction transaction = series();
    transaction.changeMonth(DECEMBER, new BigDecimal("680"), DECEMBER.atDay(5), "Discount");
    transaction.changeMonth(DECEMBER, new BigDecimal("690"), DECEMBER.atDay(6), null);
    assertThat(transaction.getMonths()).hasSize(1);
    assertThat(transaction.amountIn(DECEMBER)).isEqualByComparingTo("690");
    assertThat(transaction.amountIn(DECEMBER.minusMonths(1))).isEqualByComparingTo("700");
    assertThat(transaction.amountIn(DECEMBER.plusMonths(1))).isEqualByComparingTo("700");
    assertThat(transaction.getMonths().getFirst().getDate()).isEqualTo(DECEMBER.atDay(6));
    assertThat(transaction.getMonths().getFirst().getNotes()).isNull();
    transaction.skipMonth(DECEMBER);
    transaction.skipMonth(DECEMBER);
    assertThat(transaction.getMonths()).hasSize(1);
    assertThat(transaction.amountIn(DECEMBER)).isZero();
    transaction.restoreMonth(DECEMBER);
    assertThat(transaction.amountIn(DECEMBER)).isEqualByComparingTo("700");
  }

  @Test
  void cutIsInclusiveAndDropsOnlyOverridesAtOrAfterTheCut() {
    Transaction transaction = series();
    transaction.skipMonth(DECEMBER.minusMonths(1));
    transaction.skipMonth(DECEMBER);
    transaction.skipMonth(DECEMBER.plusMonths(1));
    transaction.endBefore(DECEMBER);
    assertThat(transaction.getRepeatUntil()).isEqualTo(LocalDate.of(2026, 11, 1));
    assertThat(transaction.occursIn(DECEMBER.minusMonths(1))).isTrue();
    assertThat(transaction.occursIn(DECEMBER)).isFalse();
    assertThat(transaction.amountIn(DECEMBER)).isZero();
    assertThat(transaction.getMonths()).hasSize(1);
    assertThatThrownBy(() -> transaction.skipMonth(DECEMBER))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void validatesDatesAmountsAndSeriesRange() {
    Transaction transaction = series();
    assertThatThrownBy(() ->
            transaction.changeMonth(
                DECEMBER, BigDecimal.ONE, DECEMBER.minusMonths(1).atDay(1), null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> transaction.changeMonth(DECEMBER, BigDecimal.ZERO, DECEMBER.atDay(1), null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> transaction.skipMonth(YearMonth.of(2026, 10)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> transaction.endBefore(YearMonth.of(2026, 11)))
        .isInstanceOf(IllegalArgumentException.class);
    transaction.setRepeats(RepeatInterval.NONE);
    assertThatThrownBy(() -> transaction.skipMonth(DECEMBER))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(transaction.getMonths()).isEmpty();
  }

  private Transaction series() {
    return Transaction.builder()
        .repeats(RepeatInterval.MONTHLY)
        .date(LocalDate.of(2026, 11, 30))
        .totalValue(new BigDecimal("700"))
        .build();
  }
}
