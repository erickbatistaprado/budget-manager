package com.budgetmanager.bm.ledger.infrastructure.persistence;

import com.budgetmanager.bm.ledger.domain.Card;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, UUID> {
  List<Card> findByUserIdOrderByNameAsc(UUID userId);

  Optional<Card> findByIdAndUserId(UUID id, UUID userId);

  Optional<Card> findByUserIdAndNameIgnoreCase(UUID userId, String name);
}
