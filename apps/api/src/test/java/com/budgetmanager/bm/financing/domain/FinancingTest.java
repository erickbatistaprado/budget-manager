package com.budgetmanager.bm.financing.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class FinancingTest {
  private Financing contract() {
    var financing = new Financing();
    financing.setTerms(
        new Amortization.Terms(
            Amortization.System.SAC,
            new BigDecimal("12000"),
            new BigDecimal("0.01"),
            12,
            LocalDate.of(2026, 1, 28),
            null,
            null,
            null));
    return financing;
  }

  @Test
  void derivesScheduleFromOrderedChangesAndPreservesPaidRows() {
    var financing = contract();
    financing.addChange(
        new Amortization.Change("PAID", null, new BigDecimal("1123.45"), null, 1, null));
    var paid = financing.schedule().getFirst();
    financing.addChange(new Amortization.Change("DUE_DAY", null, null, null, 2, 7));
    financing.addChange(
        new Amortization.Change(
            "EXTRA_PAYMENT",
            LocalDate.of(2026, 2, 1),
            new BigDecimal("2000"),
            "REDUCE_TERM",
            null,
            null));
    assertThat(financing.schedule().getFirst()).isEqualTo(paid);
    assertThat(financing.schedule().get(1).dueDate()).isEqualTo(LocalDate.of(2026, 3, 7));
    assertThat(financing.schedule()).hasSize(10);
    assertThat(financing.schedule())
        .isEqualTo(Amortization.replay(financing.getTerms(), financing.getChanges()));
  }

  @Test
  void rejectsInvalidChangeWithoutAddingItToHistory() {
    var financing = contract();
    var original = financing.schedule();
    assertThatThrownBy(() ->
            financing.addChange(
                new Amortization.Change(
                    "EXTRA_PAYMENT",
                    LocalDate.of(2026, 1, 1),
                    new BigDecimal("13000"),
                    "REDUCE_TERM",
                    null,
                    null)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(financing.getChanges()).isEmpty();
    assertThat(financing.schedule()).isEqualTo(original);
  }

  @Test
  void reconstructsMonthlyTermsFromStoredAnnualRate() {
    var financing = contract();
    financing.setRate(new BigDecimal("0.12"));
    financing.setRatePeriod(Financing.RatePeriod.ANNUAL);
    assertThat(financing.getTerms().monthlyRate())
        .isEqualByComparingTo(Amortization.monthlyRateFromAnnual(new BigDecimal("0.12")));
  }
}
