package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.application.CardService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/cards")
@RequiredArgsConstructor
public class CardController {
  private final CardService service;

  @GetMapping
  public List<CardDto> list() {
    return service.list().stream().map(CardDto::from).toList();
  }

  @PostMapping
  public ResponseEntity<CardDto> create(@Valid @RequestBody CardDto draft) {
    CardDto saved =
        CardDto.from(service.save(null, draft.name(), draft.closingDay(), draft.dueDay()));
    return ResponseEntity.created(URI.create("/cards/" + saved.id())).body(saved);
  }

  @PutMapping("/{id}")
  public CardDto update(@PathVariable UUID id, @Valid @RequestBody CardDto draft) {
    return CardDto.from(service.save(id, draft.name(), draft.closingDay(), draft.dueDay()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
