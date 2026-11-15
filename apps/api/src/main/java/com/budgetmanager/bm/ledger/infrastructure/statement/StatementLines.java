package com.budgetmanager.bm.ledger.infrastructure.statement;

import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

/** Builds statement lines from raw rows. */
final class StatementLines {

  static final Map<String, Integer> PORTUGUESE_MONTHS =
      Map.ofEntries(
          Map.entry("JAN", 1),
          Map.entry("FEV", 2),
          Map.entry("MAR", 3),
          Map.entry("ABR", 4),
          Map.entry("MAI", 5),
          Map.entry("JUN", 6),
          Map.entry("JUL", 7),
          Map.entry("AGO", 8),
          Map.entry("SET", 9),
          Map.entry("OUT", 10),
          Map.entry("NOV", 11),
          Map.entry("DEZ", 12));

  /** Which date a statement prints next to an installment. */
  enum InstallmentDate {
    /** The original purchase date, which is also the first installment's date (Bradesco). */
    PURCHASE,
    /** The date this installment was billed (NuBank). */
    BILLING
  }

  private StatementLines() {}

  static StatementLine line(
      LocalDate date,
      String description,
      BigDecimal signedAmount,
      String cardholder,
      InstallmentDate installmentDate) {
    boolean credit = signedAmount.signum() < 0;
    Optional<StatementText.Installment> installment =
        credit ? Optional.empty() : StatementText.installment(description);
    if (installment.isEmpty()) {
      return new StatementLine(
          date,
          StatementText.truncate(description.strip()),
          signedAmount.abs(),
          credit,
          null,
          null,
          cardholder);
    }
    StatementText.Installment parts = installment.get();
    LocalDate lineDate;
    if (parts.paidEarly() || installmentDate == InstallmentDate.PURCHASE) {
      lineDate = date;
    } else {
      lineDate = date.minusMonths((long) parts.number() - 1);
    }
    return new StatementLine(
        lineDate,
        StatementText.truncate(parts.purchase()),
        signedAmount,
        false,
        parts.number(),
        parts.total(),
        cardholder,
        parts.paidEarly());
  }

  /** Statements print day and month only; a month after the closing month is last year's. */
  static LocalDate dateInStatementYear(int day, int month, int closingMonth, int closingYear) {
    return LocalDate.of(month > closingMonth ? closingYear - 1 : closingYear, month, day);
  }
}
