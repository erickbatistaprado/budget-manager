package com.budgetmanager.bm.ledger.domain.statement;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Objects;

/**
 * One purchase, fee or credit read from a statement.
 *
 * <p>{@code date} is the date the transaction is stored with. For an installment purchase it is the
 * date of the first installment, so the schedule lines up with the statement that showed it. {@code
 * amount} is always positive; {@code credit} tells refunds and discounts apart from expenses. For
 * installments, {@code amount} is one installment and {@code description} is the purchase without
 * the installment suffix.
 */
public record StatementLine(
    LocalDate date,
    String description,
    BigDecimal amount,
    boolean credit,
    Integer installmentNumber,
    Integer installmentTotal,
    String cardholder) {

  public StatementLine {
    Objects.requireNonNull(date, "date");
    Objects.requireNonNull(description, "description");
    Objects.requireNonNull(amount, "amount");
    if (amount.signum() < 0) {
      throw new IllegalArgumentException("amount must be positive; use credit for refunds");
    }
    amount = amount.setScale(2, RoundingMode.HALF_UP);
    description = description.strip().replaceAll("\\s+", " ");
  }

  public boolean isInstallment() {
    return installmentTotal != null && installmentTotal >= 2 && installmentNumber != null;
  }

  /** The value of the whole purchase: every installment, or just the amount. */
  public BigDecimal totalValue() {
    return isInstallment() ? amount.multiply(BigDecimal.valueOf(installmentTotal)) : amount;
  }
}
