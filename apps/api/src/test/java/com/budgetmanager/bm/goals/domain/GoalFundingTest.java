package com.budgetmanager.bm.goals.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class GoalFundingTest {
  private static final YearMonth START = YearMonth.of(2026, 11);

  private static BigDecimal money(String amount) {
    return new BigDecimal(amount);
  }

  private static GoalFunding.Item item(String price, String fixed, LocalDate target) {
    return new GoalFunding.Item(
        UUID.randomUUID(),
        money(price),
        BigDecimal.ZERO,
        fixed == null ? null : money(fixed),
        target);
  }

  @Test
  void waterfallUsesRankAndCarriesRemainderToNextGoal() {
    var first = item("150", null, null);
    var second = item("100", null, null);
    var split = GoalFunding.split(List.of(first, second), money("200"));
    assertThat(split.get(first.id())).isEqualByComparingTo("150");
    assertThat(split.get(second.id())).isEqualByComparingTo("50");
    var months = GoalFunding.simulate(List.of(first, second), money("100"), START);
    assertThat(months.get(first.id())).isEqualTo(START.plusMonths(1));
    assertThat(months.get(second.id())).isEqualTo(START.plusMonths(2));
  }

  @Test
  void fixedAmountsAreServedFirstAndCannotExceedTheBudgetOrRemainingPrice() {
    var first = item("200", null, null);
    var second = item("40", "70", null);
    var split = GoalFunding.split(List.of(first, second), money("100"));
    assertThat(split.get(first.id())).isEqualByComparingTo("60");
    assertThat(split.get(second.id())).isEqualByComparingTo("40");
    assertThat(GoalFunding.split(List.of(first, second), money("20")).get(second.id()))
        .isEqualByComparingTo("20");
  }

  @Test
  void stopsAt120MonthsAndHandlesZeroPaceAndAlreadyFunded() {
    var within = item("120", null, null);
    var beyond = item("1", null, null);
    var months = GoalFunding.simulate(List.of(within, beyond), BigDecimal.ONE, START);
    assertThat(months.get(within.id())).isEqualTo(START.plusMonths(119));
    assertThat(months).doesNotContainKey(beyond.id());
    assertThat(GoalFunding.simulate(List.of(within), BigDecimal.ZERO, START)).isEmpty();
    var funded = new GoalFunding.Item(UUID.randomUUID(), money("10"), money("10"), null, null);
    assertThat(GoalFunding.simulate(List.of(funded), BigDecimal.ZERO, START).get(funded.id()))
        .isEqualTo(START);
  }

  @Test
  void warningGivesMinimumExtraPaceUnderTheSameFundingRules() {
    var first = item("100", null, null);
    var second = item("200", "20", START.plusMonths(1).atEndOfMonth());
    var forecasts = GoalFunding.project(List.of(first, second), money("100"), START);
    var warning = forecasts.get(1);
    assertThat(warning.late()).isTrue();
    assertThat(warning.extraMonthlyAmount()).isEqualByComparingTo("50");
    assertThat(warning.firstPositionMonth()).isEqualTo(START.plusMonths(1));
    var adjusted = GoalFunding.project(List.of(first, second), money("150"), START).get(1);
    assertThat(adjusted.late()).isFalse();
    assertThat(GoalFunding.project(List.of(first, second), money("149.99"), START).get(1).late())
        .isTrue();
  }

  @Test
  void pastDeadlineHasNoInventedExtraAmount() {
    var goal = item("100", null, START.minusMonths(1).atEndOfMonth());
    var forecast = GoalFunding.project(List.of(goal), money("50"), START).getFirst();
    assertThat(forecast.late()).isTrue();
    assertThat(forecast.extraMonthlyAmount()).isNull();
  }

  @Test
  void negativeHistoryCountsAsZeroAndMissingMonthsKeepSixMonthDenominator() {
    assertThat(GoalFunding.average(List.of(money("600"), money("-300"), money("120"))))
        .isEqualByComparingTo("120");
  }

  @Test
  void movePreservesOtherRanksAndAllocationCannotOverRelease() {
    assertThat(GoalFunding.move(List.of("first", "second", "third"), "third", 1))
        .containsExactly("third", "first", "second");
    assertThatThrownBy(() -> GoalFunding.move(List.of("first"), "first", 2))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(GoalFunding.allocate(money("50"), money("25"))).isEqualByComparingTo("75");
    assertThat(GoalFunding.allocate(money("50"), money("-50"))).isEqualByComparingTo("0");
    assertThatThrownBy(() -> GoalFunding.allocate(money("50"), money("-51")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> GoalFunding.allocate(money("50"), BigDecimal.ZERO))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
