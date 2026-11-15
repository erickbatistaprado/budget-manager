package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.Account;
import com.budgetmanager.bm.ledger.domain.Bank;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record AccountDto(UUID id, @NotBlank @Size(max = 255) String name, @NotNull Bank bank) {
  public static AccountDto from(Account account) {
    return new AccountDto(account.getId(), account.getName(), account.getBank());
  }
}
