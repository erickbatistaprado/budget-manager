package com.budgetmanager.bm.goals.infrastructure.persistence;

import com.budgetmanager.bm.goals.domain.Goal;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalRepository extends JpaRepository<Goal, UUID> {
  List<Goal> findByUserIdOrderByPositionAsc(UUID userId);

  Optional<Goal> findByIdAndUserId(UUID id, UUID userId);
}
