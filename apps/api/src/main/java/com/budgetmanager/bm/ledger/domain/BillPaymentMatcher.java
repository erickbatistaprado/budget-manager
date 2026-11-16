package com.budgetmanager.bm.ledger.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

public final class BillPaymentMatcher {
  private BillPaymentMatcher() {}

  /** Conservative statement-import hook: exact account/amount, within three days, unique match. */
  public static Optional<Movement> match(
      List<Movement> movements,
      UUID accountId,
      LocalDate date,
      BigDecimal amount,
      String description) {
    if (description == null || description.isBlank()) {
      return Optional.empty();
    }
    List<Movement> candidates =
        movements.stream()
            .filter(movement ->
                movement.getKind() == MovementKind.CARD_BILL_PAYMENT
                    && accountId.equals(movement.getFromAccountId())
                    && amount.abs().compareTo(movement.getAmount()) == 0
                    && Math.abs(ChronoUnit.DAYS.between(date, movement.getDate())) <= 3)
            .toList();
    return candidates.size() == 1 ? Optional.of(candidates.getFirst()) : Optional.empty();
  }
}
