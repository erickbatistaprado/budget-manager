package com.budgetmanager.bm.savings.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class SavingValueTest {
  private static final LocalDate DATE = LocalDate.of(2026, 1, 1);

  @Test
  void valuationsReplaceEarlierContributionsAndIncludeOnlyLaterFlows() {
    var contributions =
        List.of(
            new SavingValue.Contribution(DATE, new BigDecimal("100")),
            new SavingValue.Contribution(DATE.plusDays(1), new BigDecimal("50")),
            new SavingValue.Contribution(DATE.plusDays(2), new BigDecimal("-30")));
    SavingValuation valuation = new SavingValuation();
    valuation.setDate(DATE.plusDays(1));
    valuation.setValue(new BigDecimal("160"));
    assertThat(SavingValue.at(DATE.minusDays(1), contributions, List.of(valuation))).isZero();
    assertThat(SavingValue.at(DATE, contributions, List.of(valuation))).isEqualByComparingTo("100");
    assertThat(SavingValue.at(DATE.plusDays(1), contributions, List.of(valuation)))
        .isEqualByComparingTo("160");
    assertThat(SavingValue.at(DATE.plusDays(2), contributions, List.of(valuation)))
        .isEqualByComparingTo("130");
    assertThat(SavingValue.at(DATE.plusDays(2), contributions, List.of()))
        .isEqualByComparingTo("120");
  }

  @Test
  void redemptionCannotExceedCurrentValue() {
    assertThatThrownBy(() -> SavingValue.requireRedemption(BigDecimal.TEN, new BigDecimal("10.01")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> SavingValue.requireRedemption(BigDecimal.TEN, BigDecimal.TEN))
        .doesNotThrowAnyException();
  }
}
