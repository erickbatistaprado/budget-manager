package com.budgetmanager.bm.ledger.domain;

import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

/** Matches one card charge to a live monthly occurrence, preferring its description. */
public final class SubscriptionMatcher {
  private SubscriptionMatcher() {}

  public static YearMonth billMonth(Card card, LocalDate dueDate, StatementLine line) {
    return YearMonth.from(dueDate == null ? card.billDueDate(line.date()) : dueDate);
  }

  public static Optional<Transaction> match(
      List<Transaction> subscriptions, Card card, LocalDate dueDate, StatementLine line) {
    if (card == null || line.isInstallment() || line.paidEarly()) {
      return Optional.empty();
    }
    YearMonth month = billMonth(card, dueDate, line);
    List<Transaction> candidates =
        subscriptions.stream()
            .filter(series ->
                series.getFinancingId() == null
                    && series.getCard() != null
                    && card.getId().equals(series.getCard().getId())
                    && series.occursIn(month)
                    && series.amountIn(month).signum() > 0
                    && (series.getCategory().getTransactionType() == TransactionType.INCOME)
                        == line.credit())
            .toList();
    Optional<Transaction> description =
        candidates.stream()
            .filter(series -> descriptionsMatch(series.getNotes(), line.description()))
            .findFirst();
    if (description.isPresent()) {
      return description;
    }
    return candidates.stream()
        .filter(series ->
            series.amountIn(month).subtract(line.amount()).abs().compareTo(new BigDecimal("0.05"))
                <= 0)
        .findFirst();
  }

  public static boolean descriptionsMatch(String saved, String incoming) {
    String left = StatementText.normalize(saved);
    String right = StatementText.normalize(incoming);
    if (left.isEmpty() || right.isEmpty()) {
      return false;
    }
    return left.equals(right)
        || (Math.min(left.length(), right.length()) >= 6
            && (left.startsWith(right) || right.startsWith(left)));
  }
}
