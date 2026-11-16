package com.budgetmanager.bm.goals.domain;

import com.budgetmanager.bm.ledger.domain.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class GoalSavingsTips {
  private GoalSavingsTips() {}

  public record Tip(
      UUID categoryId,
      String category,
      BigDecimal amount,
      BigDecimal average,
      BigDecimal difference,
      BigDecimal percentAbove,
      UUID goalId,
      String goalName,
      YearMonth expectedMonth,
      YearMonth improvedMonth,
      Long monthsGained) {}

  /**
   * Habits follow the purchase date: a single card purchase counts in the month it was made, not
   * the month its bill is due, while installments and repeats keep their own months.
   */
  private static List<Map.Entry<LocalDate, BigDecimal>> spending(
      Transaction transaction, LocalDate end) {
    if (transaction.getInstallments().isEmpty() && transaction.getBillDueDate() != null) {
      return transaction.getDate().isAfter(end)
          ? List.of()
          : List.of(Map.entry(transaction.getDate(), transaction.getTotalValue()));
    }
    return TransactionOccurrence.expand(transaction, end).stream()
        .map(occurrence -> Map.entry(occurrence.date(), occurrence.amount()))
        .toList();
  }

  public static List<Tip> calculate(
      List<Transaction> transactions,
      YearMonth selected,
      List<GoalFunding.Item> items,
      BigDecimal pace,
      YearMonth start,
      String goalName) {
    Map<UUID, BigDecimal> current = new HashMap<>();
    Map<UUID, BigDecimal> historical = new HashMap<>();
    Map<UUID, String> names = new HashMap<>();
    for (Transaction transaction : transactions) {
      if (transaction.getCategory().getTransactionType() != TransactionType.EXPENSE
          || transaction.getRepeats() == RepeatInterval.MONTHLY
          || transaction.getFinancingId() != null
          || Boolean.TRUE.equals(transaction.getCategory().getFixedCost())) {
        continue;
      }
      UUID categoryId = transaction.getCategory().getId();
      names.put(categoryId, transaction.getCategory().getName());
      for (var spent : spending(transaction, selected.atEndOfMonth())) {
        YearMonth occurred = YearMonth.from(spent.getKey());
        if (occurred.equals(selected)) {
          current.merge(categoryId, spent.getValue(), BigDecimal::add);
        } else if (!occurred.isBefore(selected.minusMonths(6))) {
          historical.merge(categoryId, spent.getValue(), BigDecimal::add);
        }
      }
    }
    GoalFunding.Item first = items.isEmpty() ? null : items.getFirst();
    YearMonth expected =
        first == null ? null : GoalFunding.simulate(items, pace, start).get(first.id());
    List<Tip> tips = new ArrayList<>();
    for (var entry : current.entrySet()) {
      BigDecimal average =
          historical
              .getOrDefault(entry.getKey(), BigDecimal.ZERO)
              .divide(BigDecimal.valueOf(6), 2, java.math.RoundingMode.HALF_UP);
      BigDecimal difference = entry.getValue().subtract(average);
      if (difference.signum() <= 0) {
        continue;
      }
      YearMonth improved =
          first == null
              ? null
              : GoalFunding.simulate(items, pace.add(difference), start).get(first.id());
      Long gained =
          expected == null || improved == null
              ? null
              : Math.max(0, java.time.temporal.ChronoUnit.MONTHS.between(improved, expected));
      BigDecimal percent =
          average.signum() == 0
              ? null
              : difference
                  .multiply(BigDecimal.valueOf(100))
                  .divide(average, 2, java.math.RoundingMode.HALF_UP);
      tips.add(
          new Tip(
              entry.getKey(),
              names.get(entry.getKey()),
              entry.getValue(),
              average,
              difference,
              percent,
              first == null ? null : first.id(),
              first == null ? null : goalName,
              expected,
              improved,
              gained));
    }
    return tips.stream()
        .sorted(
            Comparator.comparing(Tip::difference)
                .reversed()
                .thenComparing(Tip::category)
                .thenComparing(Tip::categoryId))
        .limit(3)
        .toList();
  }
}
