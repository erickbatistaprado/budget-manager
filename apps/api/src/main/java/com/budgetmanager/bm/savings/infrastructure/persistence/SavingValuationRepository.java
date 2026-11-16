package com.budgetmanager.bm.savings.infrastructure.persistence;

import com.budgetmanager.bm.savings.domain.SavingValuation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavingValuationRepository extends JpaRepository<SavingValuation, UUID> {
  List<SavingValuation> findBySavingId(UUID savingId);

  @org.springframework.data.jpa.repository.Query(
      "SELECT valuation FROM SavingValuation valuation, Saving saving WHERE valuation.savingId = saving.id AND saving.user.id = :userId AND saving.id IN :savingIds")
  List<SavingValuation> findOwnedBySavingIds(List<UUID> savingIds, UUID userId);

  List<SavingValuation> findBySavingIdIn(List<UUID> savingIds);
}
