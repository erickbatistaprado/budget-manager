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

  @GetMapping
  public List<AccountDto> list() {
    return service.list().stream().map(AccountDto::from).toList();
  }

  @PostMapping
  public ResponseEntity<AccountDto> create(@Valid @RequestBody AccountDto draft) {
    AccountDto saved = AccountDto.from(service.save(null, draft.name(), draft.bank()));
    return ResponseEntity.created(URI.create("/accounts/" + saved.id())).body(saved);
  }

  @PutMapping("/{id}")
  public AccountDto update(@PathVariable UUID id, @Valid @RequestBody AccountDto draft) {
    return AccountDto.from(service.save(id, draft.name(), draft.bank()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }
}
