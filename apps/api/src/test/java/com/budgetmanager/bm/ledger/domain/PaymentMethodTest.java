package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;

class PaymentMethodTest {
  private Transaction draft(TransactionType type) {
    return Transaction.builder()
        .category(Category.builder().transactionType(type).build())
        .date(LocalDate.of(2026, 11, 1))
        .totalValue(BigDecimal.TEN)
        .repeats(RepeatInterval.NONE)
        .build();
  }

  @Test
  void cardAndMethodMustMatchAndCreditCannotHaveAnAccount() {
    Transaction transaction = draft(TransactionType.EXPENSE);
    transaction.setPaymentMethod(PaymentMethod.CREDIT_CARD);
    assertThatThrownBy(transaction::validatePayment).isInstanceOf(IllegalArgumentException.class);
    transaction.setCard(new Card());
    assertThatCode(transaction::validatePayment).doesNotThrowAnyException();
    transaction.setAccount(new Account());
    assertThatThrownBy(transaction::validatePayment).isInstanceOf(IllegalArgumentException.class);
    transaction.setAccount(null);
    transaction.setPaymentMethod(null);
    assertThatThrownBy(transaction::validatePayment).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void validatesEveryExpenseMethodWithAndWithoutAnAccount() {
    for (PaymentMethod method : PaymentMethod.values()) {
      if (method == PaymentMethod.CREDIT_CARD) {
        continue;
      }
      Transaction transaction = draft(TransactionType.EXPENSE);
      transaction.setPaymentMethod(method);
      assertThatCode(transaction::validatePayment).doesNotThrowAnyException();
      transaction.setAccount(new Account());
      if (method == PaymentMethod.CASH || method == PaymentMethod.OTHER) {
        assertThatThrownBy(transaction::validatePayment)
            .isInstanceOf(IllegalArgumentException.class);
      } else {
        assertThatCode(transaction::validatePayment).doesNotThrowAnyException();
      }
    }
    Transaction unknown = draft(TransactionType.EXPENSE);
    assertThatCode(unknown::validatePayment).doesNotThrowAnyException();
    unknown.setAccount(new Account());
    assertThatThrownBy(unknown::validatePayment).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void incomeAllowsOnlyItsFourMethodsIncludingAccounts() {
    for (PaymentMethod method : PaymentMethod.values()) {
      Transaction transaction = draft(TransactionType.INCOME);
      transaction.setPaymentMethod(method);
      transaction.setAccount(new Account());
      if (method == PaymentMethod.PIX
          || method == PaymentMethod.BANK_TRANSFER
          || method == PaymentMethod.CASH
          || method == PaymentMethod.OTHER) {
        assertThatCode(transaction::validatePayment).doesNotThrowAnyException();
      } else {
        assertThatThrownBy(transaction::validatePayment)
            .isInstanceOf(IllegalArgumentException.class);
      }
    }
  }

  @Test
  void monthlyOverridesKeepPaymentAndAccountButMonthlyCreditIsRejected() {
    Transaction transaction = draft(TransactionType.EXPENSE);
    transaction.setRepeats(RepeatInterval.MONTHLY);
    transaction.setPaymentMethod(PaymentMethod.BOLETO);
    Account account = new Account();
    transaction.setAccount(account);
    transaction.validatePayment();
    transaction.changeMonth(
        YearMonth.of(2026, 11), BigDecimal.ONE, LocalDate.of(2026, 11, 5), "Rent");
    assertThat(transaction.getAccount()).isSameAs(account);
    assertThat(transaction.getPaymentMethod()).isEqualTo(PaymentMethod.BOLETO);
    transaction.setAccount(null);
    transaction.setCard(new Card());
    transaction.setPaymentMethod(PaymentMethod.CREDIT_CARD);
    assertThatThrownBy(transaction::validatePayment).isInstanceOf(IllegalArgumentException.class);
  }
}
