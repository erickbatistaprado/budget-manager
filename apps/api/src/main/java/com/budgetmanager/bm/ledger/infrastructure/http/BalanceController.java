package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.application.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/accounts/{id}")
@RequiredArgsConstructor
public class BalanceController {
  private final MoneyFlowService service;

  public record Draft(
      @NotNull @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      @NotNull BigDecimal balance,
      Boolean preview) {}

  public record Result(
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      BigDecimal computed,
      BigDecimal balance,
      BigDecimal difference,
      boolean saved) {}

  public record Checkpoint(
      UUID id, @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date, BigDecimal balance) {}

  @GetMapping("/balance")
  public Result balance(
      @PathVariable UUID id, @RequestParam @DateTimeFormat(pattern = "yyyy/MM/dd") LocalDate date) {
    service.checkpoints(id);
    BigDecimal value = service.snapshot(date).balance(id, date);
    return new Result(date, value, value, BigDecimal.ZERO, false);
  }

  @PostMapping("/balance-checkpoints")
  public Result checkpoint(@PathVariable UUID id, @Valid @RequestBody Draft draft) {
    var result =
        service.checkpoint(id, draft.date(), draft.balance(), Boolean.TRUE.equals(draft.preview()));
    return new Result(
        result.date(), result.computed(), result.balance(), result.difference(), result.saved());
  }

  @GetMapping("/balance-checkpoints")
  public List<Checkpoint> checkpoints(@PathVariable UUID id) {
    return service.checkpoints(id).stream()
        .map(checkpoint ->
            new Checkpoint(checkpoint.getId(), checkpoint.getDate(), checkpoint.getBalance()))
        .toList();
  }

  @DeleteMapping("/balance-checkpoints/{checkpointId}")
  public ResponseEntity<Void> delete(@PathVariable UUID id, @PathVariable UUID checkpointId) {
    service.deleteCheckpoint(id, checkpointId);
    return ResponseEntity.noContent().build();
  }
}
