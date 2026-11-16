package com.budgetmanager.bm.goals.domain;

import java.math.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Pure funding rules, reusable by the future split preview and purchase workflow. */
public final class GoalFunding {
  public static final int HORIZON = 120;

  private GoalFunding() {}

  public record Item(
      UUID id,
      BigDecimal price,
      BigDecimal saved,
      BigDecimal monthlyAmount,
      LocalDate targetDate) {}

  public record Forecast(
      UUID id,
      BigDecimal saved,
      BigDecimal remaining,
      YearMonth expectedMonth,
      boolean late,
      BigDecimal extraMonthlyAmount,
      YearMonth firstPositionMonth) {}

  public static BigDecimal average(List<BigDecimal> kept) {
    return kept.stream()
        .map(amount -> amount.max(BigDecimal.ZERO))
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .divide(BigDecimal.valueOf(6), 2, RoundingMode.HALF_UP);
  }

  public static Map<UUID, BigDecimal> split(List<Item> items, BigDecimal budget) {
    Map<UUID, BigDecimal> allocations = new LinkedHashMap<>();
    items.forEach(item -> allocations.put(item.id(), BigDecimal.ZERO));
    BigDecimal available = budget.max(BigDecimal.ZERO);
    for (Item item : items) {
      BigDecimal fixed = item.monthlyAmount() == null ? BigDecimal.ZERO : item.monthlyAmount();
      BigDecimal amount =
          fixed.min(item.price().subtract(item.saved()).max(BigDecimal.ZERO)).min(available);
      allocations.put(item.id(), amount);
      available = available.subtract(amount);
    }
    for (Item item : items) {
      BigDecimal fixed = allocations.get(item.id());
      BigDecimal amount =
          item.price().subtract(item.saved()).subtract(fixed).max(BigDecimal.ZERO).min(available);
      allocations.put(item.id(), fixed.add(amount));
      available = available.subtract(amount);
    }
    return allocations;
  }

  public static BigDecimal remainder(
      BigDecimal kept, BigDecimal amount, Collection<BigDecimal> lines) {
    if (kept == null
        || amount == null
        || amount.signum() <= 0
        || amount.compareTo(kept) > 0
        || lines.stream().anyMatch(value -> value == null || value.signum() < 0)) {
      throw new IllegalArgumentException("Invalid split or amount exceeds the month's kept amount");
    }
    BigDecimal assigned = lines.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    if (assigned.compareTo(amount) > 0) {
      throw new IllegalArgumentException("Split exceeds the kept amount");
    }
    return amount.subtract(assigned);
  }

  public static Map<UUID, YearMonth> simulate(List<Item> items, BigDecimal pace, YearMonth start) {
    Map<UUID, BigDecimal> saved = new HashMap<>();
    Map<UUID, YearMonth> months = new HashMap<>();
    items.forEach(item -> {
      saved.put(item.id(), item.saved());
      if (item.saved().compareTo(item.price()) >= 0) {
        months.put(item.id(), start);
      }
    });
    for (int offset = 0; offset < HORIZON; offset++) {
      List<Item> current =
          items.stream()
              .map(item ->
                  new Item(
                      item.id(),
                      item.price(),
                      saved.get(item.id()),
                      item.monthlyAmount(),
                      item.targetDate()))
              .toList();
      Map<UUID, BigDecimal> split = split(current, pace);
      for (Item item : items) {
        saved.put(item.id(), saved.get(item.id()).add(split.get(item.id())));
        if (saved.get(item.id()).compareTo(item.price()) >= 0) {
          months.putIfAbsent(item.id(), start.plusMonths(offset));
        }
      }
    }
    return months;
  }

  public static List<Forecast> project(List<Item> items, BigDecimal pace, YearMonth start) {
    Map<UUID, YearMonth> months = simulate(items, pace, start);
    return items.stream()
        .map(item -> {
          YearMonth expected = months.get(item.id());
          YearMonth target = item.targetDate() == null ? null : YearMonth.from(item.targetDate());
          boolean late = target != null && (expected == null || expected.isAfter(target));
          BigDecimal extra = null;
          YearMonth first = null;
          if (late) {
            long count = ChronoUnit.MONTHS.between(start, target) + 1;
            if (count > 0 && count <= HORIZON) {
              long low = pace.movePointRight(2).longValue();
              long base = low;
              long high =
                  items.stream()
                      .map(candidate ->
                          candidate.price().subtract(candidate.saved()).max(BigDecimal.ZERO))
                      .reduce(BigDecimal.ZERO, BigDecimal::add)
                      .add(pace)
                      .movePointRight(2)
                      .setScale(0, RoundingMode.CEILING)
                      .longValueExact();
              while (low < high) {
                long middle = low + (high - low) / 2;
                YearMonth trial =
                    simulate(items, BigDecimal.valueOf(middle, 2), start).get(item.id());
                if (trial != null && !trial.isAfter(target)) {
                  high = middle;
                } else {
                  low = middle + 1;
                }
              }
              extra = BigDecimal.valueOf(low - base, 2);
            }
            List<Item> reordered = new ArrayList<>(items);
            reordered.remove(item);
            reordered.addFirst(item);
            first = simulate(reordered, pace, start).get(item.id());
          }
          return new Forecast(
              item.id(),
              item.saved(),
              item.price().subtract(item.saved()).max(BigDecimal.ZERO),
              expected,
              late,
              extra,
              first);
        })
        .toList();
  }

  public static <T> List<T> move(List<T> ranked, T item, int position) {
    if (position < 1 || position > ranked.size()) {
      throw new IllegalArgumentException("Invalid position");
    }
    List<T> reordered = new ArrayList<>(ranked);
    reordered.remove(item);
    reordered.add(position - 1, item);
    return reordered;
  }

  public static BigDecimal allocate(BigDecimal saved, BigDecimal amount) {
    if (amount == null || amount.signum() == 0 || saved.add(amount).signum() < 0) {
      throw new IllegalArgumentException(
          "Allocation must be nonzero and cannot release more than saved");
    }
    return saved.add(amount);
  }
}
