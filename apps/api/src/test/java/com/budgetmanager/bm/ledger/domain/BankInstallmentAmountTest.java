package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BankInstallmentAmountTest {
  private Transaction purchase() {
    Transaction purchase =
        Transaction.builder()
            .date(LocalDate.of(2026, 10, 5))
            .totalValue(new BigDecimal("1516.00"))
            .installmentNumbers(3)
            .build();
    purchase.scheduleInstallments();
    return purchase;
  }

  @Test
  void acceptsOneRealInclusiveAndPreservesOtherInstallmentsAndTheSum() {
    Transaction purchase = purchase();
    assertThat(purchase.adjustInstallmentAmount(3, new BigDecimal("505.33"))).isTrue();
    assertThat(purchase.getTotalValue()).isEqualByComparingTo("1515.99");
    assertThat(purchase.getInstallments())
        .extracting(Installment::getAmount)
        .containsExactly(
            new BigDecimal("505.33"), new BigDecimal("505.33"), new BigDecimal("505.33"));
    assertThat(purchase.adjustInstallmentAmount(3, new BigDecimal("506.33"))).isTrue();
    assertThat(purchase.adjustInstallmentAmount(3, new BigDecimal("506.33"))).isFalse();
    purchase.scheduleInstallments();
    assertThat(purchase.getInstallments().getLast().getAmount()).isEqualByComparingTo("506.33");
  }

  @Test
  void rejectsAboveOneRealPaidEarlyAndFinancing() {
    Transaction purchase = purchase();
    assertThat(purchase.adjustInstallmentAmount(1, new BigDecimal("506.34"))).isFalse();
    purchase.payInstallmentEarly(2, purchase.getDate());
    assertThat(purchase.adjustInstallmentAmount(2, new BigDecimal("505.32"))).isFalse();
    purchase.setFinancingId(UUID.randomUUID());
    assertThat(purchase.adjustInstallmentAmount(3, new BigDecimal("505.32"))).isFalse();
    assertThat(purchase.getTotalValue()).isEqualByComparingTo("1516.00");
  }
}
