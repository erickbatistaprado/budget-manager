package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.application.CardService;
import com.budgetmanager.bm.ledger.application.MoneyFlowService;
import com.budgetmanager.bm.ledger.domain.Card;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
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
  private final MoneyFlowService ledger;
  private final Clock clock;

  @GetMapping
  public List<CardDto> list() {
    var limits = ledger.cardLimits(LocalDate.now(clock));
    return service.list().stream()
        .map(card -> CardDto.from(card, limits.get(card.getId())))
        .toList();
  }

  @PostMapping
  public ResponseEntity<CardDto> create(@Valid @RequestBody CardDraft draft) {
    CardDto saved =
        response(
            service.save(
                null,
                draft.name(),
                draft.closingDay(),
                draft.dueDay(),
                draft.bank(),
                draft.paymentAccountId(),
                draft.fundingAccountId(),
                draft.creditLimit(),
                draft.billPaymentMethod()));
    return ResponseEntity.created(URI.create("/cards/" + saved.id())).body(saved);
  }

  @PutMapping("/{id}")
  public CardDto update(@PathVariable UUID id, @Valid @RequestBody CardDraft draft) {
    return response(
        service.save(
            id,
            draft.name(),
            draft.closingDay(),
            draft.dueDay(),
            draft.bank(),
            draft.paymentAccountId(),
            draft.fundingAccountId(),
            draft.creditLimit(),
            draft.billPaymentMethod()));
  }

  private CardDto response(Card card) {
    return CardDto.from(card, ledger.cardLimits(LocalDate.now(clock)).get(card.getId()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
