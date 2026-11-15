package com.budgetmanager.bm.ledger.infrastructure.persistence;

import com.budgetmanager.bm.ledger.domain.Account;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountRepository extends JpaRepository<Account, UUID> {
  List<Account> findByUserIdOrderByNameAsc(UUID userId);

  Optional<Account> findByIdAndUserId(UUID id, UUID userId);

  Optional<Account> findByUserIdAndNameIgnoreCase(UUID userId, String name);
}
