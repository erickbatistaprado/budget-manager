package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.application.MoneyFlowService;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/movements")
@RequiredArgsConstructor
public class MovementController {
  private final MoneyFlowService service;

  @GetMapping
  public List<MovementResponse> list(
      @RequestParam @DateTimeFormat(pattern = "yyyy/MM/dd") LocalDate startDate,
      @RequestParam @DateTimeFormat(pattern = "yyyy/MM/dd") LocalDate endDate) {
    return service.list(startDate, endDate).stream().map(MovementResponse::from).toList();
  }

  @PostMapping
  public ResponseEntity<MovementResponse> create(@Valid @RequestBody MovementDraft draft) {
    var saved = MovementResponse.from(service.save(null, draft.toDomain()));
    return ResponseEntity.created(URI.create("/movements/" + saved.id())).body(saved);
  }

  @RequestMapping(
      value = "/automatic",
      method = {RequestMethod.PUT, RequestMethod.DELETE})
  public void automatic() {
    throw new com.budgetmanager.bm.shared.application.ApplicationException(
        com.budgetmanager.bm.shared.application.ApplicationError.BAD_REQUEST,
        "Automatic movements cannot be changed; record the payment instead");
  }

  @PutMapping("/{id}")
  public MovementResponse update(@PathVariable UUID id, @Valid @RequestBody MovementDraft draft) {
    return MovementResponse.from(service.save(id, draft.toDomain()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
