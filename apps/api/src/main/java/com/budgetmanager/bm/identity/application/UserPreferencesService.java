package com.budgetmanager.bm.identity.application;

import com.budgetmanager.bm.ledger.application.AccountService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserPreferencesService {
  private final UserService users;
  private final AccountService accounts;

  @Transactional
  public void update(Integer salaryDay, UUID mainAccountId) {
    if (mainAccountId != null) {
      accounts.requireOwned(mainAccountId, users.requireCurrentUser());
    }
    users.updatePreferences(salaryDay);
    users.updateMainAccount(mainAccountId);
  }
}
