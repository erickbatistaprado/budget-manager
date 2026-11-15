package com.budgetmanager.bm.ledger.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "t_transaction_month")
@Getter
@Setter
@NoArgsConstructor
public class TransactionMonth {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "transaction_id", nullable = false)
  private Transaction transaction;

  @Column(nullable = false)
  private LocalDate month;

  @Column(precision = 19, scale = 2)
  private BigDecimal amount;

  private LocalDate date;
  private String notes;

  @Column(nullable = false)
  private boolean skipped;

  @CreationTimestamp
  @Column(updatable = false)
  private Instant createdAt;

  @UpdateTimestamp private Instant updatedAt;
}
