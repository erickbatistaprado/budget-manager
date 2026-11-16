package com.budgetmanager.bm.savings.infrastructure.http;

import com.budgetmanager.bm.ledger.infrastructure.http.MovementResponse;
import com.budgetmanager.bm.savings.application.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/savings/{id}")
@RequiredArgsConstructor
public class SavingHistoryController {
  private final SavingHistoryService history;
  private final SavingMoneyService money;
  private final SavingValuationService valuations;

  public record Valuation(
      UUID id, @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date, BigDecimal value) {}

  public record Draft(
      @NotNull @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      @NotNull @DecimalMin("0") BigDecimal value) {}

  public record History(List<MovementResponse> movements, List<Valuation> valuations) {
    public History {
      movements = List.copyOf(movements);
      valuations = List.copyOf(valuations);
    }
  }

  @GetMapping("/history")
  public History history(@PathVariable UUID id) {
    return new History(
        history.movements(id).stream()
            .sorted(Comparator.comparing(com.budgetmanager.bm.ledger.domain.Movement::getDate))
            .map(MovementResponse::from)
            .toList(),
        money.valuations().stream()
            .filter(valuation -> id.equals(valuation.getSavingId()))
            .sorted(
                Comparator.comparing(com.budgetmanager.bm.savings.domain.SavingValuation::getDate))
            .map(valuation ->
                new Valuation(valuation.getId(), valuation.getDate(), valuation.getValue()))
            .toList());
  }

  @PostMapping("/valuations")
  public Valuation value(@PathVariable UUID id, @Valid @RequestBody Draft draft) {
    var valuation = valuations.value(id, draft.date(), draft.value());
    return new Valuation(valuation.getId(), valuation.getDate(), valuation.getValue());
  }
}
