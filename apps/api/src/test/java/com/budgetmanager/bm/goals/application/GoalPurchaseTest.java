package com.budgetmanager.bm.goals.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.budgetmanager.bm.goals.domain.*;
import com.budgetmanager.bm.goals.infrastructure.persistence.*;
import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.application.*;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.overview.application.OverviewService;
import com.budgetmanager.bm.savings.application.SavingMoneyService;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GoalPurchaseTest {
  @Mock GoalRepository goals;
  @Mock GoalAllocationRepository allocations;
  @Mock UserService users;
  @Mock MoneyFlowService ledger;
  @Mock SavingMoneyService savings;
  @Mock OverviewService overview;
  @Mock TransactionService transactions;
  @Mock CategoryService categories;
  @Mock AccountService accounts;
  GoalService service;
  User owner;
  Goal goal;
  Goal next;
  UUID categoryId = UUID.randomUUID();
  UUID payingAccount = UUID.randomUUID();
  LocalDate date = LocalDate.of(2026, 11, 10);

  @BeforeEach
  void setup() {
    service =
        new GoalService(
            goals,
            allocations,
            users,
            ledger,
            savings,
            overview,
            Clock.systemUTC(),
            transactions,
            categories,
            accounts);
    owner = User.builder().id(UUID.randomUUID()).mainAccountId(UUID.randomUUID()).build();
    goal = new Goal();
    goal.setId(UUID.randomUUID());
    goal.setName("Keyboard");
    goal.setSavingId(UUID.randomUUID());
    goal.setPosition(1);
    next = new Goal();
    next.setId(UUID.randomUUID());
    next.setPosition(2);
    when(users.requireCurrentUser()).thenReturn(owner);
    when(goals.findByIdAndUserId(goal.getId(), owner.getId())).thenReturn(Optional.of(goal));
  }

  private void stubPurchase() {
    when(categories.requireOwned(categoryId, owner))
        .thenReturn(Category.builder().transactionType(TransactionType.EXPENSE).build());
    GoalAllocation allocation = new GoalAllocation();
    allocation.setAmount(new BigDecimal("200"));
    when(allocations.findByGoalIdOrderByDateAscIdAsc(goal.getId())).thenReturn(List.of(allocation));
    when(goals.findByUserIdOrderByPositionAsc(owner.getId())).thenReturn(List.of(goal, next));
    when(transactions.save(any(Transaction.class), eq(categoryId)))
        .thenAnswer(invocation -> {
          Transaction expense = invocation.getArgument(0);
          expense.setId(UUID.randomUUID());
          return expense;
        });
  }

  @Test
  void purchaseCreatesExpenseRedeemsSavedAmountReleasesEntireReservationAndRenumbers() {
    stubPurchase();
    Account account = Account.builder().id(payingAccount).build();
    when(accounts.requireOwned(payingAccount, owner)).thenReturn(account);
    service.purchase(
        goal.getId(),
        new GoalService.Purchase(
            new BigDecimal("150"),
            date,
            categoryId,
            PaymentMethod.PIX,
            null,
            payingAccount,
            null,
            null));
    ArgumentCaptor<Transaction> expense = ArgumentCaptor.forClass(Transaction.class);
    verify(transactions).save(expense.capture(), eq(categoryId));
    assertThat(expense.getValue().getTotalValue()).isEqualByComparingTo("150");
    assertThat(expense.getValue().getAccount()).isSameAs(account);
    ArgumentCaptor<Movement> redemption = ArgumentCaptor.forClass(Movement.class);
    verify(ledger).save(isNull(), redemption.capture());
    assertThat(redemption.getValue().getKind()).isEqualTo(MovementKind.REDEMPTION);
    assertThat(redemption.getValue().getToAccountId()).isEqualTo(payingAccount);
    assertThat(redemption.getValue().getAmount()).isEqualByComparingTo("200");
    ArgumentCaptor<GoalAllocation> released = ArgumentCaptor.forClass(GoalAllocation.class);
    verify(allocations).save(released.capture());
    assertThat(released.getValue().getAmount()).isEqualByComparingTo("-200");
    assertThat(goal.getStatus()).isEqualTo(Goal.Status.ACHIEVED);
    assertThat(goal.getAchievedAt()).isEqualTo(date);
    assertThat(goal.getSavedAtPurchase()).isEqualByComparingTo("200");
    assertThat(goal.getActualPrice()).isEqualByComparingTo("150");
    assertThat(goal.getExpenseTransactionId()).isEqualTo(expense.getValue().getId());
    assertThat(next.getPosition()).isEqualTo(1);
  }

  @Test
  void cardRedeemsToMainAccountAndPreservesInstallments() {
    stubPurchase();
    UUID card = UUID.randomUUID();
    service.purchase(
        goal.getId(),
        new GoalService.Purchase(
            new BigDecimal("300"),
            date,
            categoryId,
            PaymentMethod.CREDIT_CARD,
            card,
            null,
            3,
            null));
    ArgumentCaptor<Movement> redemption = ArgumentCaptor.forClass(Movement.class);
    verify(ledger).save(isNull(), redemption.capture());
    assertThat(redemption.getValue().getToAccountId()).isEqualTo(owner.getMainAccountId());
    ArgumentCaptor<Transaction> expense = ArgumentCaptor.forClass(Transaction.class);
    verify(transactions).save(expense.capture(), eq(categoryId));
    assertThat(expense.getValue().getInstallmentNumbers()).isEqualTo(3);
    assertThat(expense.getValue().getCard().getId()).isEqualTo(card);
    assertThat(expense.getValue().getAccount()).isNull();
  }

  @Test
  void refusesPurchasingAnAchievedGoalWithoutWriting() {
    goal.setStatus(Goal.Status.ACHIEVED);
    assertThatThrownBy(() ->
            service.purchase(
                goal.getId(),
                new GoalService.Purchase(
                    new BigDecimal("150"),
                    date,
                    categoryId,
                    PaymentMethod.PIX,
                    null,
                    payingAccount,
                    null,
                    null)))
        .isInstanceOf(com.budgetmanager.bm.shared.application.ApplicationException.class);
    verifyNoInteractions(transactions, ledger, allocations);
  }
}
