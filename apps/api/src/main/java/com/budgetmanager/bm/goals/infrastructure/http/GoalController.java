package com.budgetmanager.bm.goals.infrastructure.http;

import com.budgetmanager.bm.goals.application.GoalService;
import com.budgetmanager.bm.goals.domain.*;
import com.budgetmanager.bm.identity.application.UserService;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/goals")
@RequiredArgsConstructor
public class GoalController {
  private final GoalService service;
  private final UserService users;

  public record Draft(
      @NotBlank @Size(max = 255) String name,
      @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 2)
          BigDecimal price,
      @NotNull Goal.Kind kind,
      @Size(max = 2000) String link,
      @Size(max = 4000) String notes,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate targetDate,
      @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal monthlyAmount,
      UUID savingId) {
    GoalService.Draft command() {
      return new GoalService.Draft(
          name, price, kind, link, notes, targetDate, monthlyAmount, savingId);
    }
  }

  public record View(
      UUID id,
      String name,
      BigDecimal price,
      Goal.Kind kind,
      String link,
      String notes,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate targetDate,
      int position,
      BigDecimal monthlyAmount,
      UUID savingId,
      Goal.Status status,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate achievedAt,
      UUID expenseTransactionId,
      BigDecimal savedAtPurchase,
      BigDecimal actualPrice) {
    static View of(Goal goal) {
      return new View(
          goal.getId(),
          goal.getName(),
          goal.getPrice(),
          goal.getKind(),
          goal.getLink(),
          goal.getNotes(),
          goal.getTargetDate(),
          goal.getPosition(),
          goal.getMonthlyAmount(),
          goal.getSavingId(),
          goal.getStatus(),
          goal.getAchievedAt(),
          goal.getExpenseTransactionId(),
          goal.getSavedAtPurchase(),
          goal.getActualPrice());
    }
  }

  public record AllocationDraft(
      @NotNull @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      @NotNull @Digits(integer = 12, fraction = 2) BigDecimal amount,
      UUID fromAccountId) {}

  public record AllocationView(
      UUID id,
      UUID goalId,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      BigDecimal amount,
      UUID movementId) {
    static AllocationView of(GoalAllocation allocation) {
      return new AllocationView(
          allocation.getId(),
          allocation.getGoalId(),
          allocation.getDate(),
          allocation.getAmount(),
          allocation.getMovementId());
    }
  }

  public record Position(@Min(1) int position) {}

  public record Pace(
      @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal monthlyAmount) {}

  public record Forecast(
      UUID id,
      BigDecimal saved,
      BigDecimal remaining,
      String expectedMonth,
      boolean late,
      BigDecimal extraMonthlyAmount,
      String firstPositionMonth) {
    static Forecast of(GoalFunding.Forecast forecast) {
      return new Forecast(
          forecast.id(),
          forecast.saved(),
          forecast.remaining(),
          month(forecast.expectedMonth()),
          forecast.late(),
          forecast.extraMonthlyAmount(),
          month(forecast.firstPositionMonth()));
    }

    private static String month(YearMonth month) {
      return month == null ? null : month.toString();
    }
  }

  public record Plan(
      BigDecimal pace,
      BigDecimal averagePace,
      BigDecimal paceOverride,
      BigDecimal reserved,
      List<Forecast> goals) {
    public Plan {
      goals = List.copyOf(goals);
    }
  }

  public record SplitDraft(
      @NotNull @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 2)
          BigDecimal amount,
      UUID fromAccountId,
      boolean preview,
      Map<UUID, @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal>
          allocations) {
    public SplitDraft {
      allocations = allocations == null ? null : Map.copyOf(allocations);
    }
  }

  public record SplitView(Map<UUID, BigDecimal> goals, BigDecimal investmentAmount, boolean saved) {
    public SplitView {
      goals = Map.copyOf(goals);
    }
  }

  @PostMapping("/allocate")
  public SplitView split(@Valid @RequestBody SplitDraft draft) {
    var result =
        service.split(
            draft.date(),
            draft.amount(),
            draft.fromAccountId(),
            draft.preview(),
            draft.allocations());
    return new SplitView(result.goals(), result.investmentAmount(), result.saved());
  }

  public record PurchaseDraft(
      @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 2)
          BigDecimal price,
      @NotNull @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      @NotNull UUID categoryId,
      @NotNull com.budgetmanager.bm.ledger.domain.PaymentMethod paymentMethod,
      UUID cardId,
      UUID accountId,
      @Min(2) @Max(500) Integer installments,
      UUID redemptionAccountId) {}

  @PostMapping("/{id}/purchase")
  public View purchase(@PathVariable UUID id, @Valid @RequestBody PurchaseDraft draft) {
    return View.of(
        service.purchase(
            id,
            new GoalService.Purchase(
                draft.price(),
                draft.date(),
                draft.categoryId(),
                draft.paymentMethod(),
                draft.cardId(),
                draft.accountId(),
                draft.installments(),
                draft.redemptionAccountId())));
  }

  public record TipView(
      UUID categoryId,
      String category,
      BigDecimal amount,
      BigDecimal average,
      BigDecimal difference,
      BigDecimal percentAbove,
      UUID goalId,
      String goalName,
      String expectedMonth,
      String improvedMonth,
      Long monthsGained) {
    static TipView of(GoalSavingsTips.Tip tip) {
      return new TipView(
          tip.categoryId(),
          tip.category(),
          tip.amount(),
          tip.average(),
          tip.difference(),
          tip.percentAbove(),
          tip.goalId(),
          tip.goalName(),
          Forecast.month(tip.expectedMonth()),
          Forecast.month(tip.improvedMonth()),
          tip.monthsGained());
    }
  }

  @GetMapping("/savings-tips")
  public List<TipView> tips(@RequestParam(required = false) String month) {
    YearMonth selected = null;
    if (month != null) {
      try {
        selected = YearMonth.parse(month);
      } catch (java.time.format.DateTimeParseException exception) {
        throw new com.budgetmanager.bm.shared.application.ApplicationException(
            com.budgetmanager.bm.shared.application.ApplicationError.BAD_REQUEST, "Use yyyy-MM");
      }
    }
    return service.tips(selected).stream().map(TipView::of).toList();
  }

  @GetMapping
  public List<View> list() {
    return service.list().stream().map(View::of).toList();
  }

  @PostMapping
  public ResponseEntity<View> create(@Valid @RequestBody Draft draft) {
    View view = View.of(service.save(null, draft.command()));
    return ResponseEntity.created(java.net.URI.create("/goals/" + view.id())).body(view);
  }

  @PutMapping("/{id}")
  public View update(@PathVariable UUID id, @Valid @RequestBody Draft draft) {
    return View.of(service.save(id, draft.command()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/{id}/position")
  public ResponseEntity<Void> move(@PathVariable UUID id, @Valid @RequestBody Position position) {
    service.move(id, position.position());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{id}/allocations")
  public List<AllocationView> history(@PathVariable UUID id) {
    return service.history(id).stream().map(AllocationView::of).toList();
  }

  @PostMapping("/{id}/allocations")
  public AllocationView allocate(@PathVariable UUID id, @Valid @RequestBody AllocationDraft draft) {
    return AllocationView.of(
        service.allocate(id, draft.date(), draft.amount(), draft.fromAccountId()));
  }

  @GetMapping("/plan")
  public Plan plan() {
    var plan = service.plan();
    return new Plan(
        plan.pace(),
        plan.averagePace(),
        plan.paceOverride(),
        plan.reserved(),
        plan.goals().stream().map(Forecast::of).toList());
  }

  @PutMapping("/pace")
  public ResponseEntity<Void> pace(@Valid @RequestBody Pace pace) {
    users.updateGoalPace(pace.monthlyAmount());
    return ResponseEntity.noContent().build();
  }
}
