package com.budgetmanager.bm.financing.domain;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/** Pure, cent-rounded amortization. Rates are fractions, not percentages. */
public final class Amortization {
  private static final MathContext PRECISION = MathContext.DECIMAL128;

  public enum System {
    SAC,
    PRICE
  }

  public enum Option {
    REDUCE_TERM,
    REDUCE_PAYMENT
  }

  public record Row(
      int number,
      LocalDate dueDate,
      BigDecimal principal,
      BigDecimal interest,
      BigDecimal insurance,
      BigDecimal fees,
      BigDecimal payment,
      BigDecimal balance,
      BigDecimal paidAmount) {
    public Row paid(BigDecimal amount) {
      positive(amount, "Paid amount");
      return new Row(
          number, dueDate, principal, interest, insurance, fees, payment, balance, money(amount));
    }

    public Row dated(LocalDate date) {
      return new Row(
          number, date, principal, interest, insurance, fees, payment, balance, paidAmount);
    }
  }

  public record Terms(
      System system,
      BigDecimal amount,
      BigDecimal monthlyRate,
      int term,
      LocalDate firstDueDate,
      BigDecimal statedInstallment,
      BigDecimal insurance,
      BigDecimal fees) {
    public Terms {
      positive(amount, "Financed amount");
      if (system == null
          || monthlyRate == null
          || monthlyRate.signum() < 0
          || monthlyRate.compareTo(BigDecimal.ONE) > 0
          || term < 1
          || term > 500
          || firstDueDate == null) {
        throw new IllegalArgumentException(
            "Choose a system, monthly rate between 0 and 1, term (1–500) and first due date");
      }
      amount = money(amount);
      insurance = cost(insurance);
      fees = cost(fees);
      if (statedInstallment != null) {
        positive(statedInstallment, "Stated installment");
        statedInstallment = money(statedInstallment);
        if (system != System.PRICE
            || statedInstallment.multiply(BigDecimal.valueOf(term)).compareTo(amount) < 0) {
          throw new IllegalArgumentException(
              "A stated Price installment must repay the financed amount");
        }
      }
    }

    public BigDecimal effectiveRate() {
      if (statedInstallment == null) {
        return monthlyRate;
      }
      if (statedInstallment.multiply(BigDecimal.valueOf(term)).compareTo(amount) == 0) {
        return BigDecimal.ZERO;
      }
      BigDecimal lower = BigDecimal.ZERO;
      BigDecimal upper = BigDecimal.ONE;
      while (payment(amount, upper, term).compareTo(statedInstallment) < 0) {
        upper = upper.multiply(BigDecimal.TWO);
      }
      for (int iteration = 0; iteration < 80; iteration++) {
        BigDecimal middle = lower.add(upper).divide(BigDecimal.TWO, PRECISION);
        if (payment(amount, middle, term).compareTo(statedInstallment) > 0) {
          upper = middle;
        } else {
          lower = middle;
        }
      }
      return lower.add(upper).divide(BigDecimal.TWO, PRECISION);
    }
  }

  public record Simulation(Option option, List<Row> schedule, BigDecimal interestSaved) {
    public Simulation {
      schedule = List.copyOf(schedule);
    }
  }

  public record Change(
      String type,
      LocalDate date,
      BigDecimal amount,
      String option,
      Integer fromInstallment,
      Integer dueDay) {}

  /** Rebuilds the schedule from the contract and its ordered adjustment history. */
  public static List<Row> replay(Terms terms, List<Change> changes) {
    List<Row> rows = schedule(terms);
    for (Change change : changes) {
      switch (change.type()) {
        case "PAID" ->
            rows =
                rows.stream()
                    .map(row ->
                        row.number() == change.fromInstallment() ? row.paid(change.amount()) : row)
                    .toList();
        case "EXTRA_PAYMENT" ->
            rows =
                extra(terms, rows, change.date(), change.amount(), Option.valueOf(change.option()))
                    .schedule();
        case "BALANCE_SYNC" -> rows = sync(terms, rows, change.date(), change.amount());
        case "DUE_DAY" -> rows = changeDueDay(rows, change.fromInstallment(), change.dueDay());
        default -> throw new IllegalArgumentException("Unknown financing change");
      }
    }
    return List.copyOf(rows);
  }

  private Amortization() {}

  public static BigDecimal money(BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP);
  }

  public static void positive(BigDecimal value, String name) {
    if (value == null || value.signum() <= 0 || money(value).signum() <= 0) {
      throw new IllegalArgumentException(name + " must be positive");
    }
  }

  private static BigDecimal cost(BigDecimal value) {
    if (value == null) {
      return new BigDecimal("0.00");
    }
    if (value.signum() < 0) {
      throw new IllegalArgumentException("Costs cannot be negative");
    }
    return money(value);
  }

  public static BigDecimal monthlyRateFromAnnual(BigDecimal annualRate) {
    if (annualRate == null || annualRate.signum() < 0) {
      throw new IllegalArgumentException("A nonnegative annual or monthly rate is required");
    }
    BigDecimal lower = BigDecimal.ZERO;
    BigDecimal upper = annualRate.add(BigDecimal.ONE);
    BigDecimal target = annualRate.add(BigDecimal.ONE);
    for (int iteration = 0; iteration < 80; iteration++) {
      BigDecimal middle = lower.add(upper).divide(BigDecimal.TWO, PRECISION);
      if (BigDecimal.ONE.add(middle).pow(12, PRECISION).compareTo(target) > 0) {
        upper = middle;
      } else {
        lower = middle;
      }
    }
    return lower;
  }

  public static BigDecimal payment(BigDecimal balance, BigDecimal rate, int count) {
    if (rate.signum() == 0) {
      return balance.divide(BigDecimal.valueOf(count), PRECISION);
    }
    BigDecimal factor = BigDecimal.ONE.add(rate).pow(count, PRECISION);
    return balance
        .multiply(rate, PRECISION)
        .multiply(factor, PRECISION)
        .divide(factor.subtract(BigDecimal.ONE), PRECISION);
  }

  public static List<Row> schedule(Terms terms) {
    BigDecimal fixed =
        terms.statedInstallment() == null
            ? money(payment(terms.amount(), terms.effectiveRate(), terms.term()))
            : terms.statedInstallment();
    return remaining(
        terms,
        terms.amount(),
        terms.term(),
        1,
        terms.firstDueDate(),
        fixed,
        money(terms.amount().divide(BigDecimal.valueOf(terms.term()), PRECISION)));
  }

  private static List<Row> remaining(
      Terms terms,
      BigDecimal startingBalance,
      int count,
      int firstNumber,
      LocalDate firstDate,
      BigDecimal fixed,
      BigDecimal sacPrincipal) {
    List<Row> rows = new ArrayList<>();
    BigDecimal balance = money(startingBalance);
    BigDecimal rate = terms.effectiveRate();
    for (int offset = 0; offset < count && balance.signum() > 0; offset++) {
      BigDecimal interest = money(balance.multiply(rate, PRECISION));
      BigDecimal principal = terms.system() == System.SAC ? sacPrincipal : fixed.subtract(interest);
      if (principal.signum() <= 0) {
        throw new IllegalArgumentException("Payment does not amortize the balance");
      }
      if (offset == count - 1 || principal.compareTo(balance) > 0) {
        principal = balance;
      }
      balance = money(balance.subtract(principal));
      rows.add(
          new Row(
              firstNumber + offset,
              firstDate.plusMonths(offset),
              principal,
              interest,
              terms.insurance(),
              terms.fees(),
              principal.add(interest).add(terms.insurance()).add(terms.fees()),
              balance,
              null));
    }
    return List.copyOf(rows);
  }

  public static List<Row> sync(
      Terms terms, List<Row> original, LocalDate date, BigDecimal balance) {
    if (balance == null || balance.signum() < 0) {
      throw new IllegalArgumentException("Balance cannot be negative");
    }
    int boundary = boundary(original, date);
    return rebuild(terms, original, boundary, money(balance), Option.REDUCE_PAYMENT);
  }

  public static Simulation extra(
      Terms terms, List<Row> original, LocalDate date, BigDecimal amount, Option option) {
    positive(amount, "Extra payment");
    if (option == null) {
      throw new IllegalArgumentException("Choose how to apply the extra payment");
    }
    int boundary = boundary(original, date);
    BigDecimal balance =
        original.subList(boundary, original.size()).stream()
            .map(Row::principal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    if (amount.compareTo(balance) > 0) {
      throw new IllegalArgumentException("Extra payment exceeds outstanding balance");
    }
    List<Row> revised = rebuild(terms, original, boundary, balance.subtract(money(amount)), option);
    return new Simulation(option, revised, interest(original).subtract(interest(revised)));
  }

  private static int boundary(List<Row> rows, LocalDate date) {
    if (date == null) {
      throw new IllegalArgumentException("Date is required");
    }
    int boundary = 0;
    for (Row row : rows) {
      if (!row.dueDate().isAfter(date)) {
        boundary++;
      } else if (row.paidAmount() != null) {
        throw new IllegalArgumentException("Cannot recalculate a paid installment");
      }
    }
    if (boundary == rows.size()) {
      throw new IllegalArgumentException("There are no remaining installments");
    }
    return boundary;
  }

  private static List<Row> rebuild(
      Terms terms, List<Row> original, int boundary, BigDecimal balance, Option option) {
    List<Row> result = new ArrayList<>(original.subList(0, boundary));
    int count = original.size() - boundary;
    Row next = original.get(boundary);
    BigDecimal fixed = next.principal().add(next.interest());
    BigDecimal principal = next.principal();
    if (option == Option.REDUCE_PAYMENT) {
      fixed = money(payment(balance, terms.effectiveRate(), count));
      principal = money(balance.divide(BigDecimal.valueOf(count), PRECISION));
    }
    List<Row> future =
        remaining(terms, balance, count, next.number(), next.dueDate(), fixed, principal);
    for (int offset = 0; offset < future.size(); offset++) {
      result.add(future.get(offset).dated(original.get(boundary + offset).dueDate()));
    }
    return List.copyOf(result);
  }

  public static List<Row> changeDueDay(List<Row> rows, int from, int day) {
    if (day < 1 || day > 31 || from < 1 || from > rows.size()) {
      throw new IllegalArgumentException("Choose an installment and due day (1–31)");
    }
    Row first = rows.get(from - 1);
    YearMonth month = YearMonth.from(first.dueDate());
    if (day <= first.dueDate().getDayOfMonth()) {
      month = month.plusMonths(1);
    }
    List<Row> result = new ArrayList<>(rows.subList(0, from - 1));
    for (int index = from - 1; index < rows.size(); index++) {
      Row row = rows.get(index);
      if (row.paidAmount() != null) {
        throw new IllegalArgumentException("Cannot move a paid installment");
      }
      YearMonth target = month.plusMonths(index - from + 1L);
      result.add(row.dated(target.atDay(Math.min(day, target.lengthOfMonth()))));
    }
    return List.copyOf(result);
  }

  public static BigDecimal interest(List<Row> rows) {
    return rows.stream().map(Row::interest).reduce(new BigDecimal("0.00"), BigDecimal::add);
  }
}
