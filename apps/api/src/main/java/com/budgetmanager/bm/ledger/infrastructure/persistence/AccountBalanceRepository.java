package com.budgetmanager.bm.ledger.infrastructure.persistence;

import com.budgetmanager.bm.ledger.domain.AccountBalance;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountBalanceRepository extends JpaRepository<AccountBalance, UUID> {
  List<AccountBalance> findByAccountIdOrderByDateDesc(UUID accountId);

  List<AccountBalance> findByAccountIdIn(List<UUID> accountIds);
}
