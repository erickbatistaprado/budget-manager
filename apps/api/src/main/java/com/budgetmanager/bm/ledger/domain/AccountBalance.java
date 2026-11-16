package com.budgetmanager.bm.ledger.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "t_account_balance")
@Getter
@Setter
@NoArgsConstructor
public class AccountBalance {
  @Id @GeneratedValue private UUID id;
  private UUID accountId;
  private LocalDate date;
  private BigDecimal balance;
  @CreationTimestamp private Instant createdAt;
}
