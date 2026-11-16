package com.budgetmanager.bm.ledger.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

public record TransactionOccurrence(
    LocalDate date,
    BigDecimal amount,
    TransactionType type,
    UUID accountId,
    UUID cardId,
    PaymentMethod paymentMethod) {
  public static List<TransactionOccurrence> expand(Transaction transaction, LocalDate end) {
    List<TransactionOccurrence> result = new ArrayList<>();
    if (!transaction.getInstallments().isEmpty()) {
      transaction
          .getInstallments()
          .forEach(installment ->
              add(result, transaction, installment.getDueDate(), installment.getAmount(), end));
    } else if (transaction.getRepeats() == RepeatInterval.MONTHLY) {
      for (YearMonth month = YearMonth.from(transaction.getDate());
          !month.isAfter(YearMonth.from(end)) && transaction.occursIn(month);
          month = month.plusMonths(1)) {
        LocalDate date = transaction.dateIn(month);
        BigDecimal amount = transaction.amountIn(month);
        if (amount.signum() != 0) {
          add(result, transaction, date, amount, end);
        }
      }
    } else {
      LocalDate date =
          transaction.getBillDueDate() == null
              ? transaction.getDate()
              : transaction.getBillDueDate();
      while (!date.isAfter(end)) {
        add(result, transaction, date, transaction.getTotalValue(), end);
        if (transaction.getRepeats() == null || transaction.getRepeats() == RepeatInterval.NONE) {
          break;
        }
        date =
            switch (transaction.getRepeats()) {
              case DAILY -> date.plusDays(1);
              case WEEKLY -> date.plusWeeks(1);
              case YEARLY -> date.plusYears(1);
              default -> throw new IllegalArgumentException("Unsupported repeat interval");
            };
      }
    }
    return result;
  }

  private static void add(
      List<TransactionOccurrence> result,
      Transaction transaction,
      LocalDate date,
      BigDecimal amount,
      LocalDate end) {
    if (!date.isAfter(end)) {
      result.add(
          new TransactionOccurrence(
              date,
              amount,
              transaction.getCategory().getTransactionType(),
              transaction.getAccount() == null ? null : transaction.getAccount().getId(),
              transaction.getCard() == null ? null : transaction.getCard().getId(),
              transaction.getPaymentMethod()));
    }
  }

  public BigDecimal accountEffect() {
    if (paymentMethod == PaymentMethod.CREDIT_CARD) {
      return BigDecimal.ZERO;
    }
    return type == TransactionType.INCOME ? amount : amount.negate();
  }
}
