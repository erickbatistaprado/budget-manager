package com.budgetmanager.bm.ledger.infrastructure.persistence;

import com.budgetmanager.bm.ledger.domain.Movement;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MovementRepository extends JpaRepository<Movement, UUID> {
  List<Movement> findByUserId(UUID userId);

  Optional<Movement> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByFromAccountIdOrToAccountId(UUID fromAccountId, UUID toAccountId);

  boolean existsByCardId(UUID cardId);
}
