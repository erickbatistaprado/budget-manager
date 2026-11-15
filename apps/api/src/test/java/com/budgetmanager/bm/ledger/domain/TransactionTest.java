package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TransactionTest {

  private static final LocalDate JANUARY_31 = LocalDate.of(2026, 1, 31);

  @ParameterizedTest
  @CsvSource({"100.00, 3", "10.00, 3", "0.05, 2", "999.99, 7", "1.00, 500", "1234.56, 12"})
  void installmentsAlwaysAddUpToTheTotal(BigDecimal total, int count) {
    Transaction transaction = transaction(total, count);

    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments()).hasSize(count);
    assertThat(sum(transaction.getInstallments())).isEqualByComparingTo(total);
    assertThat(transaction.getInstallments())
        .allSatisfy(installment -> assertThat(installment.getAmount().scale()).isEqualTo(2));
  }

  @Test
  void leftoverCentsGoToTheLastInstallment() {
    Transaction transaction = transaction(new BigDecimal("100.00"), 3);

    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments())
        .extracting(Installment::getAmount)
        .containsExactly(new BigDecimal("33.33"), new BigDecimal("33.33"), new BigDecimal("33.34"));
  }

  @Test
  void dueDatesAreMonthlyFromTheTransactionDate() {
    Transaction transaction = transaction(new BigDecimal("30.00"), 3);

    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments())
        .extracting(Installment::getDueDate)
        .containsExactly(
            LocalDate.of(2026, 1, 31), LocalDate.of(2026, 2, 28), LocalDate.of(2026, 3, 31));
    assertThat(transaction.getInstallments())
        .extracting(Installment::getInstallmentNumber)
        .containsExactly(1, 2, 3);
  }

  @Test
  void unchangedScheduleKeepsTheExistingInstallments() {
    Transaction transaction = transaction(new BigDecimal("90.00"), 3);
    transaction.scheduleInstallments();
    transaction.getInstallments().forEach(installment -> installment.setId(UUID.randomUUID()));
    List<UUID> idsBefore = transaction.getInstallments().stream().map(Installment::getId).toList();

    transaction.setNotes("only the notes changed");
    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments()).extracting(Installment::getId).isEqualTo(idsBefore);
  }

  @Test
  void changedTotalCountOrDateRebuildsTheSchedule() {
    Transaction transaction = transaction(new BigDecimal("90.00"), 3);
    transaction.scheduleInstallments();

    transaction.setTotalValue(new BigDecimal("120.00"));
    transaction.setInstallmentNumbers(4);
    transaction.setDate(LocalDate.of(2026, 6, 1));
    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments()).hasSize(4);
    assertThat(transaction.getInstallments())
        .allSatisfy(installment -> {
          assertThat(installment.getAmount()).isEqualByComparingTo("30.00");
          assertThat(installment.getTotalInstallments()).isEqualTo(4);
        });
    assertThat(transaction.getInstallments().getFirst().getDueDate())
        .isEqualTo(LocalDate.of(2026, 6, 1));
  }

  @Test
  void removingTheInstallmentCountClearsTheSchedule() {
    Transaction transaction = transaction(new BigDecimal("90.00"), 3);
    transaction.scheduleInstallments();

    transaction.setInstallmentNumbers(null);
    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments()).isEmpty();
  }

  @Test
  void payingEarlyMovesTheInstallmentToThePaymentDay() {
    Transaction transaction = transaction(new BigDecimal("80.00"), 8);
    transaction.scheduleInstallments();

    transaction.payInstallmentEarly(7, LocalDate.of(2026, 3, 2));

    Installment seventh = transaction.getInstallments().get(6);
    assertThat(seventh.getDueDate()).isEqualTo(LocalDate.of(2026, 3, 2));
    assertThat(seventh.isPaidEarly()).isTrue();
    assertThat(transaction.getInstallments().get(7).isPaidEarly()).isFalse();
  }

  @Test
  void editingWithoutChangingTheScheduleKeepsEarlyPayments() {
    Transaction transaction = transaction(new BigDecimal("80.00"), 8);
    transaction.scheduleInstallments();
    transaction.payInstallmentEarly(8, LocalDate.of(2026, 3, 2));

    transaction.setNotes("new notes");
    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments().get(7).getDueDate())
        .isEqualTo(LocalDate.of(2026, 3, 2));
  }

  @Test
  void changingTheScheduleStartsOverWithoutEarlyPayments() {
    Transaction transaction = transaction(new BigDecimal("80.00"), 8);
    transaction.scheduleInstallments();
    transaction.payInstallmentEarly(8, LocalDate.of(2026, 3, 2));

    transaction.setTotalValue(new BigDecimal("96.00"));
    transaction.scheduleInstallments();

    assertThat(transaction.getInstallments()).noneMatch(Installment::isPaidEarly);
    assertThat(transaction.getInstallments().get(7).getDueDate())
        .isEqualTo(transaction.scheduledDueDate(8));
  }

  @Test
  void restoringPutsTheInstallmentBackInItsMonth() {
    Transaction transaction = transaction(new BigDecimal("80.00"), 8);
    transaction.scheduleInstallments();
    transaction.payInstallmentEarly(8, LocalDate.of(2026, 3, 2));

    transaction.restoreInstallment(8);

    Installment eighth = transaction.getInstallments().get(7);
    assertThat(eighth.isPaidEarly()).isFalse();
    assertThat(eighth.getDueDate()).isEqualTo(LocalDate.of(2026, 8, 31));
  }

  @Test
  void anEarlyPaymentCannotBeAfterTheDueDateOrForAMissingInstallment() {
    Transaction transaction = transaction(new BigDecimal("80.00"), 8);
    transaction.scheduleInstallments();

    assertThatThrownBy(() -> transaction.payInstallmentEarly(2, LocalDate.of(2026, 5, 1)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> transaction.payInstallmentEarly(9, LocalDate.of(2026, 2, 1)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsInstallmentCountsOutOfRange() {
    assertThatThrownBy(() -> transaction(BigDecimal.TEN, 1).scheduleInstallments())
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> transaction(BigDecimal.TEN, 501).scheduleInstallments())
        .isInstanceOf(IllegalArgumentException.class);
  }

  private static Transaction transaction(BigDecimal total, int count) {
    return Transaction.builder()
        .totalValue(total)
        .installmentNumbers(count)
        .date(JANUARY_31)
        .build();
  }

  private static BigDecimal sum(List<Installment> installments) {
    return installments.stream()
        .map(Installment::getAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }
}
