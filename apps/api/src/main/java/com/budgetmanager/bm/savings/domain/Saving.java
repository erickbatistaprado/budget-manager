package com.budgetmanager.bm.savings.domain;

import com.budgetmanager.bm.identity.domain.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Table(name = "t_saving")
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Saving {

  @Id @GeneratedValue private UUID id;

  @Column(nullable = false)
  private String name;

  @NotNull
  @Column(nullable = false, precision = 19, scale = 2)
  private BigDecimal amount;

  @NotNull
  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private SavingLocation location;

  /** Set exactly when {@code location} is {@link SavingLocation#INVESTMENT}. */
  @Enumerated(EnumType.STRING)
  @Column(name = "investment_type")
  private InvestmentType investmentType;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false)
  private User user;

  @CreationTimestamp
  @Column(updatable = false)
  private Instant createdAt;

  @UpdateTimestamp private Instant updatedAt;

  /**
   * Puts the money in a location. An investment needs its type, so the allocation can be split by
   * kind; any other location must not have one.
   */
  public void place(SavingLocation newLocation, InvestmentType newInvestmentType) {
    if (newLocation == null) {
      throw new IllegalArgumentException("Location is required");
    }
    if (newLocation == SavingLocation.INVESTMENT && newInvestmentType == null) {
      throw new IllegalArgumentException("Choose the type of investment");
    }
    if (newLocation != SavingLocation.INVESTMENT && newInvestmentType != null) {
      throw new IllegalArgumentException("Only investments have an investment type");
    }
    location = newLocation;
    investmentType = newInvestmentType;
  }
}
