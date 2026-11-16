package com.budgetmanager.bm.savings.application;

import com.budgetmanager.bm.ledger.application.MoneyFlowService;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.savings.domain.SavingValuation;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SavingHistoryService {
  private final MoneyFlowService ledger;
  private final SavingMoneyService savings;

  @Transactional(readOnly = true)
  public List<Movement> movements(UUID id) {
    savings.requireOwned(id);
    return ledger.stored().stream().filter(movement -> id.equals(movement.getSavingId())).toList();
  }

  public static BigDecimal invested(UUID id, LocalDate date, List<Movement> movements) {
    return movements.stream()
        .filter(movement -> id.equals(movement.getSavingId()) && !movement.getDate().isAfter(date))
        .map(SavingHistoryService::delta)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  public static BigDecimal value(
      UUID id, LocalDate date, List<Movement> movements, List<SavingValuation> valuations) {
    return com.budgetmanager.bm.savings.domain.SavingValue.at(
        date,
        movements.stream()
            .filter(movement -> id.equals(movement.getSavingId()))
            .map(movement ->
                new com.budgetmanager.bm.savings.domain.SavingValue.Contribution(
                    movement.getDate(), delta(movement)))
            .toList(),
        valuations.stream().filter(valuation -> id.equals(valuation.getSavingId())).toList());
  }

  private static BigDecimal delta(Movement movement) {
    return movement.getKind() == MovementKind.REDEMPTION
        ? movement.getAmount().negate()
        : movement.getAmount();
  }
}
