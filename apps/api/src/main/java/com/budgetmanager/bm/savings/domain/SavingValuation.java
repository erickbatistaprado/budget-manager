package com.budgetmanager.bm.savings.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "t_saving_valuation")
@Getter
@Setter
@NoArgsConstructor
public class SavingValuation {
  @Id @GeneratedValue private UUID id;
  private UUID savingId;
  private LocalDate date;
  private BigDecimal value;
}
