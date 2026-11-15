package com.budgetmanager.bm.ledger.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "t_installment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Installment {

  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "transaction_id", nullable = false)
  private Transaction transaction;

  @NotNull private Integer installmentNumber;

  @NotNull private Integer totalInstallments;

  @NotNull
  @Column(precision = 19, scale = 2)
  private BigDecimal amount;

  @NotNull private LocalDate dueDate;

  /** Paid before its month; {@code dueDate} is then the day it was paid. */
  @Column(name = "paid_early", nullable = false)
  @Builder.Default
  private boolean paidEarly = false;

  @CreationTimestamp
  @Column(updatable = false)
  private Instant createdAt;

  @UpdateTimestamp private Instant updatedAt;
}
