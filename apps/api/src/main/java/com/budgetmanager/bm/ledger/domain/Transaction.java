package com.budgetmanager.bm.ledger.domain;

import com.budgetmanager.bm.identity.domain.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Table(name = "t_transaction")
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Transaction {

  public static final int MIN_INSTALLMENTS = 2;
  public static final int MAX_INSTALLMENTS = 500;

  @Id @GeneratedValue private UUID id;

  @NotNull
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "category_id", nullable = false)
  private Category category;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "card_id")
  private Card card;

  @Enumerated(EnumType.STRING)
  @Column(length = 32)
  private PaymentMethod paymentMethod;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "account_id")
  private Account account;

  public void validatePayment() {
    if ((card != null) != (paymentMethod == PaymentMethod.CREDIT_CARD)) {
      throw new IllegalArgumentException(
          "Credit card payment requires a card; a card requires credit card payment");
    }
    if (paymentMethod == PaymentMethod.CREDIT_CARD && account != null) {
      throw new IllegalArgumentException("Credit card payment cannot have an account");
    }
    if (paymentMethod == PaymentMethod.CREDIT_CARD
        && repeats != null
        && repeats != RepeatInterval.NONE
        && repeats != RepeatInterval.MONTHLY) {
      throw new IllegalArgumentException("Credit card charges can only repeat monthly");
    }
    boolean income = category != null && category.getTransactionType() == TransactionType.INCOME;
    if (income
        && paymentMethod != null
        && paymentMethod != PaymentMethod.CREDIT_CARD
        && paymentMethod != PaymentMethod.PIX
        && paymentMethod != PaymentMethod.BANK_TRANSFER
        && paymentMethod != PaymentMethod.CASH
        && paymentMethod != PaymentMethod.OTHER) {
      throw new IllegalArgumentException("Income supports Pix, bank transfer, cash or other");
    }
    if (account != null
        && (paymentMethod == null
            || (!income
                && (paymentMethod == PaymentMethod.CASH
                    || paymentMethod == PaymentMethod.OTHER)))) {
      throw new IllegalArgumentException("Choose a payment method that supports an account");
    }
  }

  private LocalDate billDueDate;

  public void assignBillDueDate(LocalDate dueDate) {
    billDueDate = dueDate;
    installments.stream()
        .filter(installment -> !installment.isPaidEarly())
        .forEach(installment ->
            installment.setDueDate(scheduledDueDate(installment.getInstallmentNumber())));
  }

  @Column(nullable = false)
  @Builder.Default
  private String source = "MANUAL";

  private UUID financingId;

  public void requireUnmanaged() {
    if (financingId != null) {
      throw new IllegalArgumentException(
          "Manage this transaction through financing " + financingId);
    }
  }

  private String notes;

  @NotNull
  @Column(precision = 19, scale = 2)
  private BigDecimal totalValue;

  @Max(value = MAX_INSTALLMENTS, message = "Value cannot exceed 500")
  @Min(value = 1, message = "Minimum value is 1")
  private Integer installmentNumbers;

  @OneToMany(
      mappedBy = "transaction",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.LAZY)
  @Builder.Default
  private List<Installment> installments = new ArrayList<>();

  @Enumerated(EnumType.STRING)
  private RepeatInterval repeats;

  private LocalDate repeatUntil;

  @OneToMany(mappedBy = "transaction", cascade = CascadeType.ALL, orphanRemoval = true)
  @Builder.Default
  private List<TransactionMonth> months = new ArrayList<>();

  public boolean occursIn(YearMonth month) {
    return repeats == RepeatInterval.MONTHLY
        && month != null
        && !month.isBefore(YearMonth.from(date))
        && (repeatUntil == null || !month.isAfter(YearMonth.from(repeatUntil)));
  }

  public void requireMonth(YearMonth month) {
    if (!occursIn(month)) {
      throw new IllegalArgumentException("Choose a month covered by this monthly series");
    }
  }

  public void changeMonth(
      YearMonth month, BigDecimal amount, LocalDate dueDate, String monthNotes) {
    requireMonth(month);
    if (amount == null
        || amount.signum() <= 0
        || dueDate == null
        || !YearMonth.from(dueDate).equals(month)) {
      throw new IllegalArgumentException(
          "A positive amount and a date inside the chosen month are required");
    }
    TransactionMonth change = monthOverride(month);
    change.setAmount(amount);
    change.setDate(dueDate);
    change.setNotes(monthNotes);
    change.setSkipped(false);
  }

  public void skipMonth(YearMonth month) {
    requireMonth(month);
    TransactionMonth change = monthOverride(month);
    change.setAmount(null);
    change.setDate(null);
    change.setNotes(null);
    change.setSkipped(true);
  }

  public void restoreMonth(YearMonth month) {
    requireMonth(month);
    months.removeIf(change -> change.getMonth().equals(month.atDay(1)));
  }

  public BigDecimal amountIn(YearMonth month) {
    if (!occursIn(month)) {
      return BigDecimal.ZERO;
    }
    return months.stream()
        .filter(change -> change.getMonth().equals(month.atDay(1)))
        .findFirst()
        .map(change -> change.isSkipped() ? BigDecimal.ZERO : change.getAmount())
        .orElse(totalValue);
  }

  public LocalDate dateIn(YearMonth month) {
    requireMonth(month);
    return months.stream()
        .filter(change -> change.getMonth().equals(month.atDay(1)) && change.getDate() != null)
        .findFirst()
        .map(TransactionMonth::getDate)
        .orElseGet(() -> month.atDay(Math.min(date.getDayOfMonth(), month.lengthOfMonth())));
  }

  public void endBefore(YearMonth month) {
    requireMonth(month);
    if (month.equals(YearMonth.from(date))) {
      throw new IllegalArgumentException("Remove the series when ending before its first month");
    }
    repeatUntil = month.minusMonths(1).atDay(1);
    dropMonthsFrom(month);
  }

  public void dropMonthsFrom(YearMonth month) {
    months.removeIf(change -> !change.getMonth().isBefore(month.atDay(1)));
  }

  private TransactionMonth monthOverride(YearMonth month) {
    return months.stream()
        .filter(change -> change.getMonth().equals(month.atDay(1)))
        .findFirst()
        .orElseGet(() -> {
          TransactionMonth change = new TransactionMonth();
          change.setTransaction(this);
          change.setMonth(month.atDay(1));
          months.add(change);
          return change;
        });
  }

  @NotNull(message = "Date must not be null")
  private LocalDate date;

  @CreationTimestamp
  @Column(updatable = false)
  private Instant createdAt;

  @UpdateTimestamp private Instant updatedAt;

  /**
   * Rebuilds the installment schedule from the total, the date and the installment count. Each
   * installment gets the total divided by the count, rounded down to the cent, and the last one
   * also takes the cents left over, so the installments always add up to the total.
   */
  public void scheduleInstallments() {
    requireUnmanaged();
    if (installments == null) {
      installments = new ArrayList<>();
    }
    if (installmentNumbers == null) {
      installments.clear();
      return;
    }
    if (installmentNumbers < MIN_INSTALLMENTS || installmentNumbers > MAX_INSTALLMENTS) {
      throw new IllegalArgumentException("Installment count must be between 2 and 500");
    }
    if (hasSchedule()) {
      return;
    }
    installments.clear();

    BigDecimal total = totalValue.setScale(2, RoundingMode.HALF_UP);
    BigDecimal count = BigDecimal.valueOf(installmentNumbers);
    BigDecimal regularAmount = total.divide(count, 2, RoundingMode.DOWN);
    BigDecimal lastAmount = total.subtract(regularAmount.multiply(count)).add(regularAmount);

    for (int number = 1; number <= installmentNumbers; number++) {
      installments.add(
          Installment.builder()
              .transaction(this)
              .installmentNumber(number)
              .totalInstallments(installmentNumbers)
              .amount(number == installmentNumbers ? lastAmount : regularAmount)
              .dueDate(scheduledDueDate(number))
              .build());
    }
  }

  /** The month an installment falls in when nothing was paid early. */
  public LocalDate scheduledDueDate(int number) {
    return (billDueDate == null ? date : billDueDate).plusMonths((long) number - 1);
  }

  /**
   * Records that an installment was paid before its month, as when a card lets you prepay the
   * remaining installments: the installment moves to the day it was paid. A paid-early installment
   * keeps that day when the transaction is edited, unless its total, date or count change.
   */
  public void payInstallmentEarly(int number, LocalDate paidOn) {
    Installment installment = requireInstallment(number);
    if (paidOn == null) {
      throw new IllegalArgumentException("The payment date is required");
    }
    if (paidOn.isAfter(scheduledDueDate(number))) {
      throw new IllegalArgumentException(
          "Installment "
              + number
              + " is due on "
              + scheduledDueDate(number)
              + "; a later payment is not an early one");
    }
    installment.setDueDate(paidOn);
    installment.setPaidEarly(true);
  }

  /** Puts a paid-early installment back in its original month. */
  public void restoreInstallment(int number) {
    Installment installment = requireInstallment(number);
    installment.setDueDate(scheduledDueDate(number));
    installment.setPaidEarly(false);
  }

  private Installment requireInstallment(int number) {
    if (installments == null) {
      throw new IllegalArgumentException("This transaction has no installments");
    }
    return installments.stream()
        .filter(installment -> Objects.equals(installment.getInstallmentNumber(), number))
        .findFirst()
        .orElseThrow(
            () -> new IllegalArgumentException("This transaction has no installment " + number));
  }

  private boolean hasSchedule() {
    if (installments.size() != installmentNumbers) {
      return false;
    }
    BigDecimal scheduledTotal =
        installments.stream()
            .map(Installment::getAmount)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return scheduledTotal.compareTo(totalValue) == 0
        && installments.stream()
            .allMatch(installment ->
                (installment.isPaidEarly()
                        || Objects.equals(
                            installment.getDueDate(),
                            scheduledDueDate(installment.getInstallmentNumber())))
                    && Objects.equals(installment.getTotalInstallments(), installmentNumbers));
  }
}
