package com.budgetmanager.bm.financing.infrastructure.persistence;

import com.budgetmanager.bm.financing.domain.Financing;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancingRepository extends JpaRepository<Financing, UUID> {
  @EntityGraph(attributePaths = "changes")
  Optional<Financing> findByIdAndUserId(UUID id, UUID userId);

  @EntityGraph(attributePaths = "changes")
  List<Financing> findByUserIdOrderByNameAsc(UUID userId);
}
