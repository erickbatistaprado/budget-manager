package com.budgetmanager.bm.savings.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

public final class SavingValue {
  private SavingValue() {}

  public record Contribution(LocalDate date, BigDecimal amount) {}

  public static BigDecimal at(
      LocalDate date, List<Contribution> contributions, List<SavingValuation> valuations) {
    var latest =
        valuations.stream()
            .filter(valuation -> !valuation.getDate().isAfter(date))
            .max(Comparator.comparing(SavingValuation::getDate));
    LocalDate after = latest.map(SavingValuation::getDate).orElse(LocalDate.MIN);
    return latest
        .map(SavingValuation::getValue)
        .orElse(BigDecimal.ZERO)
        .add(
            contributions.stream()
                .filter(contribution ->
                    contribution.date().isAfter(after) && !contribution.date().isAfter(date))
                .map(Contribution::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
  }

  public static void requireRedemption(BigDecimal current, BigDecimal amount) {
    if (amount.signum() <= 0 || amount.compareTo(current) > 0) {
      throw new IllegalArgumentException("Redemption exceeds the current saving value");
    }
  }
}
