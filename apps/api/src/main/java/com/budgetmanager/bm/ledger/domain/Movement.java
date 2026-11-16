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
@Table(name = "t_movement")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Movement {
  @Id @GeneratedValue private UUID id;
  private UUID userId;

  @Enumerated(EnumType.STRING)
  private MovementKind kind;

  private LocalDate date;
  private BigDecimal amount;
  private UUID fromAccountId;
  private UUID toAccountId;
  private UUID cardId;
  private LocalDate billDueDate;
  private UUID savingId;
  private boolean opening;
  private String notes;
  @CreationTimestamp private Instant createdAt;
  @UpdateTimestamp private Instant updatedAt;
  @Transient private boolean automatic;

  public void validate() {
    if (kind == null || date == null || amount == null || amount.signum() <= 0) {
      throw new IllegalArgumentException("Kind, date and a positive amount are required");
    }
    boolean bill = cardId != null && billDueDate != null;
    boolean noBill = cardId == null && billDueDate == null;
    boolean valid =
        switch (kind) {
          case TRANSFER ->
              fromAccountId != null
                  && toAccountId != null
                  && !fromAccountId.equals(toAccountId)
                  && savingId == null
                  && !opening
                  && (bill || noBill);
          case CARD_BILL_PAYMENT ->
              fromAccountId != null && toAccountId == null && bill && savingId == null && !opening;
          case INVESTMENT ->
              savingId != null
                  && toAccountId == null
                  && noBill
                  && (opening ? fromAccountId == null : fromAccountId != null);
          case REDEMPTION ->
              savingId != null
                  && toAccountId != null
                  && fromAccountId == null
                  && noBill
                  && !opening;
        };
    if (!valid) {
      throw new IllegalArgumentException(
          "Invalid accounts, bill or saving for movement kind " + kind);
    }
  }

  public BigDecimal effectOn(UUID accountId) {
    BigDecimal effect = BigDecimal.ZERO;
    if (accountId.equals(fromAccountId)) {
      effect = effect.subtract(amount);
    }
    if (accountId.equals(toAccountId)) {
      effect = effect.add(amount);
    }
    return effect;
  }
}
