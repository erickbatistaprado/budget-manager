package com.budgetmanager.bm.goals.application;

import com.budgetmanager.bm.goals.domain.*;
import com.budgetmanager.bm.goals.infrastructure.persistence.*;
import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.ledger.application.*;
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
  private final TransactionService transactions;
  private final CategoryService categories;
  private final AccountService accounts;

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
    return goals.findByUserIdOrderByPositionAsc(users.requireCurrentUser().getId()).stream()
        .sorted(
            Comparator.comparing((Goal goal) -> goal.getStatus() != Goal.Status.ACTIVE)
                .thenComparingInt(Goal::getPosition))
        .toList();
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
      goal.setPosition(active().size() + 1);
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
    if (goal.getStatus() != Goal.Status.ACTIVE) {
      throw bad("Goal is not active");
    }
    try {
      renumber(GoalFunding.move(active(), goal, position));
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
    renumber(active());
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

  private List<Goal> active() {
    return list().stream().filter(goal -> goal.getStatus() == Goal.Status.ACTIVE).toList();
  }

  private List<GoalFunding.Item> items() {
    return active().stream()
        .map(goal ->
            new GoalFunding.Item(
                goal.getId(),
                goal.getPrice(),
                saved(goal.getId()),
                goal.getMonthlyAmount(),
                goal.getTargetDate()))
        .toList();
  }

  public record Split(Map<UUID, BigDecimal> goals, BigDecimal investmentAmount, boolean saved) {
    public Split {
      goals = Map.copyOf(goals);
    }
  }

  @Transactional
  public Split split(
      LocalDate date,
      BigDecimal amount,
      UUID accountId,
      boolean preview,
      Map<UUID, BigDecimal> requested) {
    lock();
    if (date == null || amount == null || amount.signum() <= 0) {
      throw bad("Invalid split");
    }
    if (accountId != null) {
      accounts.requireOwned(accountId, users.requireCurrentUser());
    }
    if (requested != null) {
      for (var entry : requested.entrySet()) {
        Goal goal = owned(entry.getKey());
        if (goal.getStatus() != Goal.Status.ACTIVE
            || entry.getValue() == null
            || entry.getValue().signum() < 0) {
          throw bad("Invalid split line");
        }
      }
    }
    YearMonth month = YearMonth.from(date);
    BigDecimal reserved =
        active().stream()
            .filter(goal -> goal.getSavingId() == null)
            .flatMap(goal -> history(goal.getId()).stream())
            .filter(allocation -> YearMonth.from(allocation.getDate()).equals(month))
            .map(GoalAllocation::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal available = overview.month(month).kept().subtract(reserved).max(BigDecimal.ZERO);
    if (amount.compareTo(available) > 0) {
      throw bad("Amount exceeds the month's kept amount");
    }
    Map<UUID, BigDecimal> split = GoalFunding.split(items(), amount);
    if (requested != null) {
      split.replaceAll((goalId, value) -> requested.getOrDefault(goalId, BigDecimal.ZERO));
    }
    BigDecimal remainder;
    try {
      remainder = GoalFunding.remainder(available, amount, split.values());
    } catch (IllegalArgumentException exception) {
      throw bad(exception.getMessage());
    }
    if (!preview) {
      for (var entry : split.entrySet()) {
        if (entry.getValue().signum() > 0) {
          allocate(entry.getKey(), date, entry.getValue(), accountId);
        }
      }
    }
    return new Split(Collections.unmodifiableMap(split), remainder, !preview);
  }

  public record Purchase(
      BigDecimal price,
      LocalDate date,
      UUID categoryId,
      PaymentMethod paymentMethod,
      UUID cardId,
      UUID accountId,
      Integer installments,
      UUID redemptionAccountId) {}

  @Transactional
  public Goal purchase(UUID id, Purchase draft) {
    lock();
    Goal goal = owned(id);
    if (goal.getStatus() != Goal.Status.ACTIVE
        || draft.price() == null
        || draft.price().signum() <= 0
        || draft.date() == null
        || draft.paymentMethod() == null) {
      throw bad("Invalid purchase");
    }
    Category category = categories.requireOwned(draft.categoryId(), users.requireCurrentUser());
    if (category.getTransactionType() != TransactionType.EXPENSE) {
      throw bad("Choose an expense category");
    }
    boolean byCard = draft.paymentMethod() == PaymentMethod.CREDIT_CARD;
    if (draft.installments() != null
        && (!byCard || draft.installments() < 2 || draft.installments() > 500)) {
      throw bad("Only credit card purchases support installments (2–500)");
    }
    Account account = null;
    if (draft.accountId() != null) {
      account = accounts.requireOwned(draft.accountId(), users.requireCurrentUser());
    }
    if (draft.redemptionAccountId() != null) {
      accounts.requireOwned(draft.redemptionAccountId(), users.requireCurrentUser());
    }
    Card card = null;
    if (draft.cardId() != null) {
      card = new Card();
      card.setId(draft.cardId());
    }
    Transaction expense =
        transactions.save(
            Transaction.builder()
                .totalValue(draft.price())
                .date(draft.date())
                .notes(goal.getName())
                .paymentMethod(draft.paymentMethod())
                .card(card)
                .account(account)
                .installmentNumbers(draft.installments())
                .build(),
            draft.categoryId());
    BigDecimal balance = saved(id);
    if (goal.getSavingId() != null && balance.signum() > 0) {
      UUID destination = byCard ? users.requireCurrentUser().getMainAccountId() : draft.accountId();
      if (destination == null) {
        destination = draft.redemptionAccountId();
      }
      if (destination == null) {
        throw bad("Choose a redemption account (main account for card purchases)");
      }
      ledger.save(
          null,
          Movement.builder()
              .kind(MovementKind.REDEMPTION)
              .date(draft.date())
              .amount(balance)
              .savingId(goal.getSavingId())
              .toAccountId(destination)
              .build());
    }
    if (balance.signum() > 0) {
      allocate(id, draft.date(), balance.negate(), null);
    }
    goal.setSavedAtPurchase(balance);
    goal.setActualPrice(draft.price());
    goal.setExpenseTransactionId(expense.getId());
    goal.setAchievedAt(draft.date());
    goal.setStatus(Goal.Status.ACHIEVED);
    goals.saveAndFlush(goal);
    renumber(active());
    return goal;
  }

  public List<GoalSavingsTips.Tip> tips(YearMonth month) {
    YearMonth selected = month == null ? YearMonth.now(clock).minusMonths(1) : month;
    return GoalSavingsTips.calculate(
        transactions.controllableExpenses(),
        selected,
        items(),
        plan().pace(),
        YearMonth.now(clock),
        active().stream().findFirst().map(Goal::getName).orElse(null));
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
