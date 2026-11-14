package com.budgetmanager.bm.ledger.infrastructure.persistence;

import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
  List<Category> findByUserIdAndTransactionTypeOrderByNameAsc(
      UUID userId, TransactionType transactionType);

  Optional<Category> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByUserIdAndTransactionTypeAndNameIgnoreCase(
      UUID userId, TransactionType transactionType, String name);

  /** Copies the defaults from {@code t_default_category}, skipping names the user already has. */
  @Modifying
  @Query(
      nativeQuery = true,
      value =
          """
              INSERT INTO t_category (id, created_at, updated_at, name, transaction_type, user_id)
              SELECT gen_random_uuid(), now(), now(), d.name, d.transaction_type, :userId
              FROM t_default_category d
              WHERE NOT EXISTS (
                SELECT 1
                FROM t_category c
                WHERE c.user_id = :userId
                  AND c.transaction_type = d.transaction_type
                  AND lower(c.name) = lower(d.name)
              )
          """)
  int addDefaultCategories(@Param("userId") UUID userId);
}
