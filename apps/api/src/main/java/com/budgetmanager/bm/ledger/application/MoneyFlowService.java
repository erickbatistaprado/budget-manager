package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.ledger.infrastructure.persistence.*;
import com.budgetmanager.bm.savings.application.*;
import com.budgetmanager.bm.shared.application.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MoneyFlowService {
  private final MovementRepository movements;
  private final TransactionRepository transactions;
  private final AccountBalanceRepository checkpoints;
  private final AccountService accounts;
  private final CardService cards;
  private final UserService users;
  private final SavingMoneyService savings;

  public record Snapshot(
      List<Account> accounts,
      List<TransactionOccurrence> entries,
      List<Movement> movements,
      List<MoneyFlow.Bill> bills,
      List<AccountBalance> checkpoints,
      LocalDate firstTransaction) {
    public Snapshot {
      accounts = List.copyOf(accounts);
      entries = List.copyOf(entries);
      movements = List.copyOf(movements);
      bills = List.copyOf(bills);
      checkpoints = List.copyOf(checkpoints);
    }

    public BigDecimal balance(UUID accountId, LocalDate date) {
      return MoneyFlow.balance(accountId, date, checkpoints, entries, movements);
    }
  }

  @Transactional(readOnly = true)
  public List<Movement> stored() {
    return movements.findByUserId(users.requireCurrentUser().getId());
  }

  @Transactional(readOnly = true)
  public Snapshot snapshot(LocalDate end) {
    UUID userId = users.requireCurrentUser().getId();
    List<Transaction> data = transactions.findMoneyFlowData(userId);
    transactions.loadMoneyFlowMonths(userId);
    List<TransactionOccurrence> entries =
        data.stream()
            .flatMap(transaction -> TransactionOccurrence.expand(transaction, end).stream())
            .toList();
    List<MoneyFlow.Bill> bills = MoneyFlow.bills(entries, cards.list());
    LocalDate first =
        data.stream().map(Transaction::getDate).min(LocalDate::compareTo).orElse(null);
    List<Account> accountList = accounts.list();
    return new Snapshot(
        accountList,
        entries,
        MoneyFlow.movements(movements.findByUserId(userId), bills, first),
        bills,
        checkpoints.findByAccountIdIn(accountList.stream().map(Account::getId).toList()),
        first);
  }

  @Transactional(readOnly = true)
  public List<Movement> list(LocalDate start, LocalDate end) {
    if (start.isAfter(end)) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Start date must precede end date");
    }
    return snapshot(end).movements().stream()
        .filter(movement -> !movement.getDate().isBefore(start) && !movement.getDate().isAfter(end))
        .toList();
  }

  @Transactional(readOnly = true)
  public Optional<Movement> matchBillPayment(
      UUID accountId, LocalDate date, BigDecimal amount, String description) {
    accounts.requireOwned(accountId, users.requireCurrentUser());
    return BillPaymentMatcher.match(
        snapshot(date.plusDays(3)).movements(), accountId, date, amount, description);
  }

  @Transactional
  public Movement save(UUID id, Movement draft) {
    var user = users.requireCurrentUser();
    Movement previous = id == null ? null : requireOwned(id);
    try {
      draft.validate();
    } catch (IllegalArgumentException exception) {
      throw new ApplicationException(
          exception, ApplicationError.BAD_REQUEST, exception.getMessage());
    }
    if (draft.getFromAccountId() != null) {
      accounts.requireOwned(draft.getFromAccountId(), user);
    }
    if (draft.getToAccountId() != null) {
      accounts.requireOwned(draft.getToAccountId(), user);
    }
    if (draft.getCardId() != null) {
      cards.requireOwned(draft.getCardId(), user);
    }
    if (draft.getSavingId() != null) {
      savings.lockOwned(draft.getSavingId());
    }
    if (draft.getCardId() != null
        && movements.findByUserId(user.getId()).stream()
            .anyMatch(existing ->
                !existing.getId().equals(id)
                    && draft.getCardId().equals(existing.getCardId())
                    && draft.getBillDueDate().equals(existing.getBillDueDate())
                    && draft.getKind() == existing.getKind())) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "A movement already records this bill");
    }
    if (draft.getKind() == MovementKind.REDEMPTION) {
      BigDecimal available = savings.requireOwned(draft.getSavingId()).getAmount();
      if (previous != null
          && draft.getSavingId().equals(previous.getSavingId())
          && previous.getKind() == MovementKind.REDEMPTION) {
        available = available.add(previous.getAmount());
      }
      try {
        com.budgetmanager.bm.savings.domain.SavingValue.requireRedemption(
            available, draft.getAmount());
      } catch (IllegalArgumentException exception) {
        throw new ApplicationException(
            exception, ApplicationError.BAD_REQUEST, exception.getMessage());
      }
    }
    UUID previousSaving = previous == null ? null : previous.getSavingId();
    draft.setId(id);
    draft.setUserId(user.getId());
    if (previous != null) {
      draft.setCreatedAt(previous.getCreatedAt());
    }
    Movement saved = movements.saveAndFlush(draft);
    if (previousSaving != null && !previousSaving.equals(draft.getSavingId())) {
      reconcile(previousSaving);
    }
    if (draft.getSavingId() != null) {
      reconcile(draft.getSavingId());
    }
    return saved;
  }

  private void reconcile(UUID savingId) {
    savings.reconcile(
        savingId,
        stored().stream()
            .filter(movement -> savingId.equals(movement.getSavingId()))
            .map(movement ->
                new com.budgetmanager.bm.savings.domain.SavingValue.Contribution(
                    movement.getDate(),
                    movement.getKind() == MovementKind.REDEMPTION
                        ? movement.getAmount().negate()
                        : movement.getAmount()))
            .toList());
  }

  private Movement requireOwned(UUID id) {
    return movements
        .findByIdAndUserId(id, users.requireCurrentUser().getId())
        .orElseThrow(() ->
            new ApplicationException(
                ApplicationError.NOT_FOUND,
                "Movement not found; automatic payments must be recorded instead"));
  }

  @Transactional
  public void delete(UUID id) {
    Movement movement = requireOwned(id);
    movements.delete(movement);
    movements.flush();
    if (movement.getSavingId() != null) {
      reconcile(movement.getSavingId());
    }
  }

  @EventListener
  @Transactional
  public void opening(SavingOpened saving) {
    if (saving.amount().signum() <= 0) {
      return;
    }
    movements.save(
        Movement.builder()
            .userId(saving.userId())
            .savingId(saving.id())
            .kind(MovementKind.INVESTMENT)
            .date(saving.date())
            .amount(saving.amount())
            .opening(true)
            .build());
  }

  @Transactional(readOnly = true)
  public List<AccountBalance> checkpoints(UUID accountId) {
    accounts.requireOwned(accountId, users.requireCurrentUser());
    return checkpoints.findByAccountIdOrderByDateDesc(accountId);
  }

  public record BalanceResult(
      LocalDate date,
      BigDecimal computed,
      BigDecimal balance,
      BigDecimal difference,
      boolean saved) {}

  @Transactional
  public BalanceResult checkpoint(
      UUID accountId, LocalDate date, BigDecimal balance, boolean preview) {
    accounts.requireOwned(accountId, users.requireCurrentUser());
    if (date == null || balance == null) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Date and balance are required");
    }
    BigDecimal computed = snapshot(date).balance(accountId, date);
    if (!preview) {
      AccountBalance checkpoint =
          checkpoints(accountId).stream()
              .filter(existing -> existing.getDate().equals(date))
              .findFirst()
              .orElseGet(AccountBalance::new);
      checkpoint.setAccountId(accountId);
      checkpoint.setDate(date);
      checkpoint.setBalance(balance);
      checkpoints.save(checkpoint);
    }
    return new BalanceResult(date, computed, balance, balance.subtract(computed), !preview);
  }

  @Transactional
  public void deleteCheckpoint(UUID accountId, UUID id) {
    AccountBalance checkpoint =
        checkpoints(accountId).stream()
            .filter(existing -> existing.getId().equals(id))
            .findFirst()
            .orElseThrow(
                () -> new ApplicationException(ApplicationError.NOT_FOUND, "Checkpoint not found"));
    checkpoints.delete(checkpoint);
  }
}
