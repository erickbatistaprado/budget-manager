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

  private String notes;

  @NotNull
  @Column(precision = 19, scale = 2)
  private BigDecimal totalValue;

  @Max(value = MAX_INSTALLMENTS, message = "Value cannot exceed 500")
  @Min(value = MIN_INSTALLMENTS, message = "Minimum value is 2")
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
    return date.plusMonths((long) number - 1);
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
