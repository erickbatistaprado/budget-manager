package com.budgetmanager.bm.ledger.domain;

import com.budgetmanager.bm.identity.domain.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "t_card")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Card {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(nullable = false)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  @Builder.Default
  private Bank bank = Bank.OTHER;

  private int closingDay;
  private int dueDay;

  @CreationTimestamp
  @Column(updatable = false)
  private Instant createdAt;

  @UpdateTimestamp private Instant updatedAt;

  public LocalDate billDueDate(LocalDate purchaseDate) {
    return billDueDate(purchaseDate, closingDay, dueDay);
  }

  public static LocalDate billDueDate(LocalDate purchaseDate, int closingDay, int dueDay) {
    if (purchaseDate == null || closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) {
      throw new IllegalArgumentException("A purchase date and days between 1 and 31 are required");
    }
    YearMonth month = YearMonth.from(purchaseDate);
    LocalDate closing = month.atDay(Math.min(closingDay, month.lengthOfMonth()));
    if (purchaseDate.isAfter(closing)) {
      month = month.plusMonths(1);
      closing = month.atDay(Math.min(closingDay, month.lengthOfMonth()));
    }
    LocalDate due = month.atDay(Math.min(dueDay, month.lengthOfMonth()));
    if (!due.isAfter(closing)) {
      month = month.plusMonths(1);
      due = month.atDay(Math.min(dueDay, month.lengthOfMonth()));
    }
    return due;
  }
}
