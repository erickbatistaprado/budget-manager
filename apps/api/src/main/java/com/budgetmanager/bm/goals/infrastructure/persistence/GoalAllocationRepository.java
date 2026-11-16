package com.budgetmanager.bm.goals.infrastructure.persistence;

import com.budgetmanager.bm.goals.domain.GoalAllocation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalAllocationRepository extends JpaRepository<GoalAllocation, UUID> {
  List<GoalAllocation> findByGoalIdOrderByDateAscIdAsc(UUID goalId);

  List<GoalAllocation> findByGoalIdIn(Collection<UUID> goalIds);
}
