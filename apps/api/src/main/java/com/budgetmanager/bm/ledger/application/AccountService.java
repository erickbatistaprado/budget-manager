package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Account;
import com.budgetmanager.bm.ledger.domain.Bank;
import com.budgetmanager.bm.ledger.infrastructure.persistence.AccountRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccountService {
  private final AccountRepository repository;
  private final UserService userService;

  @Transactional(readOnly = true)
  public List<Account> list() {
    return repository.findByUserIdOrderByNameAsc(userService.requireCurrentUser().getId());
  }

  public Account requireOwned(UUID id, User user) {
    return repository
        .findByIdAndUserId(id, user.getId())
        .orElseThrow(
            () -> new ApplicationException(ApplicationError.NOT_FOUND, "Account not found"));
  }

  @Transactional
  public Account save(UUID id, String name, Bank bank) {
    User user = userService.requireCurrentUser();
    Account account = id == null ? Account.builder().user(user).build() : requireOwned(id, user);
    if (name == null || name.isBlank() || name.trim().length() > 255 || bank == null) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Name and bank are required");
    }
    repository
        .findByUserIdAndNameIgnoreCase(user.getId(), name.trim())
        .ifPresent(existing -> {
          if (!existing.getId().equals(id)) {
            throw new ApplicationException(
                ApplicationError.BAD_REQUEST, "An account with this name already exists");
          }
        });
    account.setName(name.trim());
    account.setBank(bank);
    return repository.saveAndFlush(account);
  }

  @Transactional
  public void delete(UUID id) {
    repository.delete(requireOwned(id, userService.requireCurrentUser()));
  }
}
