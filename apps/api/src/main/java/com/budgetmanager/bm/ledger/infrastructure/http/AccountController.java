package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.application.AccountService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/accounts")
@RequiredArgsConstructor
public class AccountController {
  private final AccountService service;
  private final com.budgetmanager.bm.ledger.application.MoneyFlowService money;
  private final java.time.Clock clock;

  @GetMapping
  public List<AccountResponse> list() {
    var today = java.time.LocalDate.now(clock);
    var snapshot = money.snapshot(today);
    return snapshot.accounts().stream()
        .map(account ->
            new AccountResponse(
                account.getId(),
                account.getName(),
                account.getBank(),
                snapshot.balance(account.getId(), today),
                com.budgetmanager.bm.ledger.domain.MoneyFlow.checkpoint(
                        snapshot.checkpoints(), account.getId(), today)
                    .map(com.budgetmanager.bm.ledger.domain.AccountBalance::getDate)
                    .orElse(null)))
        .toList();
  }

  @PostMapping
  public ResponseEntity<AccountResponse> create(@Valid @RequestBody AccountDto draft) {
    var account = service.save(null, draft.name(), draft.bank());
    AccountResponse saved = response(account.getId());
    return ResponseEntity.created(URI.create("/accounts/" + saved.id())).body(saved);
  }

  @PutMapping("/{id}")
  public AccountResponse update(@PathVariable UUID id, @Valid @RequestBody AccountDto draft) {
    service.save(id, draft.name(), draft.bank());
    return response(id);
  }

  private AccountResponse response(UUID id) {
    return list().stream().filter(account -> account.id().equals(id)).findFirst().orElseThrow();
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
