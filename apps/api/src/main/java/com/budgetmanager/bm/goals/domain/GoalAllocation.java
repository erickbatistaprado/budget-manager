package com.budgetmanager.bm.goals.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "t_goal_allocation")
@Getter
@Setter
@NoArgsConstructor
public class GoalAllocation {
  @Id @GeneratedValue private UUID id;
  private UUID goalId;
  private LocalDate date;
  private BigDecimal amount;
  private UUID movementId;
}
