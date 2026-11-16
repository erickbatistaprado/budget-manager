package com.budgetmanager.bm.savings.application;

import com.budgetmanager.bm.ledger.application.MoneyFlowService;
import com.budgetmanager.bm.ledger.domain.MovementKind;
import com.budgetmanager.bm.savings.domain.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SavingValuationService {
  private final MoneyFlowService ledger;
  private final SavingMoneyService money;

  @Transactional
  public SavingValuation value(UUID id, LocalDate date, BigDecimal value) {
    var valuation = money.value(id, date, value);
    money.reconcile(
        id,
        ledger.stored().stream()
            .filter(movement -> id.equals(movement.getSavingId()))
            .map(movement ->
                new SavingValue.Contribution(
                    movement.getDate(),
                    movement.getKind() == MovementKind.REDEMPTION
                        ? movement.getAmount().negate()
                        : movement.getAmount()))
            .toList());
    return valuation;
  }
}
