package com.budgetmanager.bm.ledger.infrastructure.persistence;

import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
  List<Category> findByUserIdAndTransactionTypeOrderByNameAsc(
      UUID userId, TransactionType transactionType);

  Optional<Category> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByUserIdAndTransactionTypeAndNameIgnoreCase(
      UUID userId, TransactionType transactionType, String name);
}
