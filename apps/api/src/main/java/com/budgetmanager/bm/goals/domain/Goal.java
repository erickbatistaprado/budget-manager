package com.budgetmanager.bm.goals.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "t_goal")
@Getter
@Setter
@NoArgsConstructor
public class Goal {
  @Id @GeneratedValue private UUID id;
  private UUID userId;
  private String name;
  private BigDecimal price;
  private String link;
  private String notes;

  @Enumerated(EnumType.STRING)
  private Kind kind;

  private LocalDate targetDate;
  private int position;
  private BigDecimal monthlyAmount;
  private UUID savingId;

  @Enumerated(EnumType.STRING)
  private Status status = Status.ACTIVE;

  private LocalDate achievedAt;
  private UUID expenseTransactionId;
  private BigDecimal savedAtPurchase;
  private BigDecimal actualPrice;

  @CreationTimestamp
  @Column(updatable = false)
  private Instant createdAt;

  @UpdateTimestamp private Instant updatedAt;

  public enum Kind {
    NEED,
    WANT
  }

  public enum Status {
    ACTIVE,
    ACHIEVED,
    CANCELLED
  }
}
