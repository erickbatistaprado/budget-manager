package com.budgetmanager.bm.goals.application;

import com.budgetmanager.bm.goals.domain.*;
import com.budgetmanager.bm.goals.infrastructure.persistence.*;
import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.ledger.application.MoneyFlowService;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.overview.application.OverviewService;
import com.budgetmanager.bm.savings.application.SavingMoneyService;
import com.budgetmanager.bm.shared.application.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GoalService {
  private final GoalRepository goals;
  private final GoalAllocationRepository allocations;
  private final UserService users;
  private final MoneyFlowService ledger;
  private final SavingMoneyService savings;
  private final OverviewService overview;
  private final Clock clock;

  public record Draft(
      String name,
      BigDecimal price,
      Goal.Kind kind,
      String link,
      String notes,
      LocalDate targetDate,
      BigDecimal monthlyAmount,
      UUID savingId) {}

  public record Plan(
      BigDecimal pace,
      BigDecimal averagePace,
      BigDecimal paceOverride,
      BigDecimal reserved,
      List<GoalFunding.Forecast> goals) {
    public Plan {
      goals = List.copyOf(goals);
    }
  }

  public List<Goal> list() {
    return goals.findByUserIdOrderByPositionAsc(users.requireCurrentUser().getId());
  }

  private Goal owned(UUID id) {
    return goals
        .findByIdAndUserId(id, users.requireCurrentUser().getId())
        .orElseThrow(() -> new ApplicationException(ApplicationError.NOT_FOUND, "Goal not found"));
  }

  // Lock the owner, including for an empty list, to serialize ranking and allocation writes.
  private void lock() {
    users.lockCurrentUser();
  }

  @Transactional
  public Goal save(UUID id, Draft draft) {
    lock();
    Goal goal = id == null ? new Goal() : owned(id);
    if (goal.getStatus() != Goal.Status.ACTIVE) {
      throw bad("Goal is not active");
    }
    if (draft.name() == null
        || draft.name().isBlank()
        || draft.price() == null
        || draft.price().signum() <= 0
        || draft.kind() == null
        || (draft.monthlyAmount() != null && draft.monthlyAmount().signum() < 0)) {
      throw bad("Invalid goal");
    }
    if (draft.savingId() != null) {
      savings.requireOwned(draft.savingId());
    }
    if (id != null && !Objects.equals(goal.getSavingId(), draft.savingId())) {
      if (saved(id).signum() != 0) {
        throw bad("Release allocations before changing the saving");
      }
    }
    if (id == null) {
      goal.setUserId(users.requireCurrentUser().getId());
      goal.setPosition(list().size() + 1);
    }
    goal.setName(draft.name().trim());
    goal.setPrice(draft.price());
    goal.setKind(draft.kind());
    goal.setLink(draft.link());
    goal.setNotes(draft.notes());
    goal.setTargetDate(draft.targetDate());
    goal.setMonthlyAmount(draft.monthlyAmount());
    goal.setSavingId(draft.savingId());
    return goals.save(goal);
  }

  @Transactional
  public void move(UUID id, int position) {
    lock();
    Goal goal = owned(id);
    try {
      renumber(GoalFunding.move(list(), goal, position));
    } catch (IllegalArgumentException exception) {
      throw bad(exception.getMessage());
    }
  }

  private void renumber(List<Goal> ranked) {
    for (int index = 0; index < ranked.size(); index++) {
      ranked.get(index).setPosition(index + 1);
    }
    goals.saveAll(ranked);
  }

  @Transactional
  public void delete(UUID id) {
    lock();
    Goal goal = owned(id);
    if (goal.getStatus() == Goal.Status.ACHIEVED) {
      throw bad("Achieved goals cannot be deleted");
    }
    goals.delete(goal);
    goals.flush();
    renumber(list());
  }

  public List<GoalAllocation> history(UUID id) {
    owned(id);
    return allocations.findByGoalIdOrderByDateAscIdAsc(id);
  }

  private BigDecimal saved(UUID id) {
    return allocations.findByGoalIdOrderByDateAscIdAsc(id).stream()
        .map(GoalAllocation::getAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  @Transactional
  public GoalAllocation allocate(UUID id, LocalDate date, BigDecimal amount, UUID accountId) {
    lock();
    Goal goal = owned(id);
    if (goal.getStatus() != Goal.Status.ACTIVE || date == null) {
      throw bad("Invalid allocation");
    }
    try {
      GoalFunding.allocate(saved(id), amount);
    } catch (IllegalArgumentException exception) {
      throw bad(exception.getMessage());
    }
    GoalAllocation allocation = new GoalAllocation();
    allocation.setGoalId(id);
    allocation.setDate(date);
    allocation.setAmount(amount);
    if (amount.signum() > 0 && goal.getSavingId() != null) {
      Movement movement =
          ledger.save(
              null,
              Movement.builder()
                  .kind(MovementKind.INVESTMENT)
                  .date(date)
                  .amount(amount)
                  .fromAccountId(accountId)
                  .savingId(goal.getSavingId())
                  .build());
      allocation.setMovementId(movement.getId());
    }
    return allocations.save(allocation);
  }

  public Plan plan() {
    YearMonth current = YearMonth.now(clock);
    List<BigDecimal> kept = overview.keptHistory(current, 6);
    BigDecimal average = GoalFunding.average(kept);
    BigDecimal override = users.requireCurrentUser().getGoalMonthlyPace();
    BigDecimal pace = override == null ? average : override;
    List<Goal> ranked =
        list().stream().filter(goal -> goal.getStatus() == Goal.Status.ACTIVE).toList();
    Map<UUID, BigDecimal> balances = new HashMap<>();
    allocations
        .findByGoalIdIn(ranked.stream().map(Goal::getId).toList())
        .forEach(allocation ->
            balances.merge(allocation.getGoalId(), allocation.getAmount(), BigDecimal::add));
    List<GoalFunding.Item> items =
        ranked.stream()
            .map(goal ->
                new GoalFunding.Item(
                    goal.getId(),
                    goal.getPrice(),
                    balances.getOrDefault(goal.getId(), BigDecimal.ZERO),
                    goal.getMonthlyAmount(),
                    goal.getTargetDate()))
            .toList();
    BigDecimal reserved =
        ranked.stream()
            .filter(goal -> goal.getSavingId() == null)
            .map(goal -> balances.getOrDefault(goal.getId(), BigDecimal.ZERO))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return new Plan(pace, average, override, reserved, GoalFunding.project(items, pace, current));
  }

  private static ApplicationException bad(String message) {
    return new ApplicationException(ApplicationError.BAD_REQUEST, message);
  }
}
