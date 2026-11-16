package com.budgetmanager.bm.overview.application;

import com.budgetmanager.bm.financing.application.FinancingService;
import com.budgetmanager.bm.financing.domain.Amortization;
import com.budgetmanager.bm.ledger.application.MoneyFlowService;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.savings.application.*;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OverviewService {
  private final MoneyFlowService ledger;
  private final SavingService savings;
  private final SavingMoneyService savingMoney;
  private final FinancingService financing;
  private final Clock clock;

  public record AccountView(
      UUID id,
      String name,
      BigDecimal balance,
      BigDecimal balanceToday,
      String balanceCheckpointDate) {}

  public record AccountSummary(UUID id, String name, Bank bank) {}

  public record BillView(
      UUID cardId,
      String card,
      String dueDate,
      BigDecimal total,
      AccountSummary paymentAccount,
      boolean automatic,
      boolean paid,
      BigDecimal creditLimit,
      BigDecimal availableLimit) {}

  public record Unassigned(long count, BigDecimal total) {}

  public record Month(
      String month,
      BigDecimal incomes,
      BigDecimal expenses,
      BigDecimal surplus,
      BigDecimal invested,
      BigDecimal kept,
      List<AccountView> accounts,
      List<BillView> bills,
      Unassigned unassigned) {
    public Month {
      accounts = List.copyOf(accounts);
      bills = List.copyOf(bills);
    }
  }

  public record Evolution(
      String month,
      BigDecimal incomes,
      BigDecimal expenses,
      BigDecimal surplus,
      BigDecimal invested,
      BigDecimal accounts,
      BigDecimal savings,
      BigDecimal debt,
      BigDecimal netWorth) {}

  public Month month(YearMonth month) {
    LocalDate today = LocalDate.now(clock);
    var snapshot =
        ledger.snapshot(month.atEndOfMonth().isAfter(today) ? month.atEndOfMonth() : today);
    var entries =
        snapshot.entries().stream()
            .filter(entry -> YearMonth.from(entry.date()).equals(month))
            .toList();
    BigDecimal incomes = total(entries, TransactionType.INCOME);
    BigDecimal expenses = total(entries, TransactionType.EXPENSE);
    BigDecimal invested = invested(snapshot.movements(), month);
    List<AccountView> accounts =
        snapshot.accounts().stream()
            .map(account ->
                new AccountView(
                    account.getId(),
                    account.getName(),
                    snapshot.balance(account.getId(), month.atEndOfMonth()),
                    snapshot.balance(account.getId(), today),
                    MoneyFlow.checkpoint(snapshot.checkpoints(), account.getId(), today)
                        .map(checkpoint -> date(checkpoint.getDate()))
                        .orElse(null)))
            .toList();
    var limits = ledger.cardLimits(today);
    List<BillView> bills =
        snapshot.bills().stream()
            .filter(bill -> YearMonth.from(bill.dueDate()).equals(month))
            .map(bill -> {
              var payment =
                  snapshot.movements().stream()
                      .filter(movement ->
                          movement.getKind() == MovementKind.CARD_BILL_PAYMENT
                              && MoneyFlow.sameBill(movement, bill))
                      .findFirst();
              UUID accountId = payment.map(Movement::getFromAccountId).orElse(null);
              AccountSummary account =
                  snapshot.accounts().stream()
                      .filter(candidate -> candidate.getId().equals(accountId))
                      .map(candidate ->
                          new AccountSummary(
                              candidate.getId(), candidate.getName(), candidate.getBank()))
                      .findFirst()
                      .orElse(null);
              return new BillView(
                  bill.cardId(),
                  bill.cardName(),
                  date(bill.dueDate()),
                  bill.total(),
                  account,
                  payment.map(Movement::isAutomatic).orElse(false),
                  payment.isPresent() && bill.dueDate().isBefore(today),
                  limits.containsKey(bill.cardId())
                      ? limits.get(bill.cardId()).creditLimit()
                      : null,
                  limits.containsKey(bill.cardId())
                      ? limits.get(bill.cardId()).availableLimit()
                      : null);
            })
            .toList();
    var unassigned =
        entries.stream()
            .filter(entry ->
                entry.accountId() == null && entry.paymentMethod() != PaymentMethod.CREDIT_CARD)
            .toList();
    BigDecimal surplus = incomes.subtract(expenses);
    return new Month(
        month.toString(),
        incomes,
        expenses,
        surplus,
        invested,
        surplus.subtract(invested),
        accounts,
        bills,
        new Unassigned(
            unassigned.size(),
            unassigned.stream()
                .map(TransactionOccurrence::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)));
  }

  public List<Evolution> evolution() {
    YearMonth current = YearMonth.now(clock);
    var snapshot = ledger.snapshot(current.atEndOfMonth());
    var savingList = savings.findAll();
    var valuations =
        savingMoney.valuations(
            savingList.stream().map(com.budgetmanager.bm.savings.domain.Saving::getId).toList());
    var loans = financing.list();
    Map<UUID, List<Amortization.Row>> schedules = new HashMap<>();
    loans.forEach(loan -> schedules.put(loan.getId(), loan.schedule()));
    List<Evolution> result = new ArrayList<>();
    if (snapshot.firstTransaction() == null) {
      return result;
    }
    for (YearMonth month = YearMonth.from(snapshot.firstTransaction());
        !month.isAfter(current);
        month = month.plusMonths(1)) {
      YearMonth selected = month;
      LocalDate end = month.atEndOfMonth();
      var entries =
          snapshot.entries().stream()
              .filter(entry -> YearMonth.from(entry.date()).equals(selected))
              .toList();
      BigDecimal incomes = total(entries, TransactionType.INCOME);
      BigDecimal expenses = total(entries, TransactionType.EXPENSE);
      BigDecimal accounts =
          snapshot.accounts().stream()
              .map(account -> snapshot.balance(account.getId(), end))
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      BigDecimal value =
          savingList.stream()
              .map(saving ->
                  SavingHistoryService.value(saving.getId(), end, snapshot.movements(), valuations))
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      BigDecimal debt =
          loans.stream()
              .map(loan ->
                  schedules.get(loan.getId()).stream()
                      .filter(row -> !row.dueDate().isAfter(end))
                      .max(Comparator.comparing(Amortization.Row::dueDate))
                      .map(Amortization.Row::balance)
                      .orElse(loan.getAmount()))
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      result.add(
          new Evolution(
              month.toString(),
              incomes,
              expenses,
              incomes.subtract(expenses),
              invested(snapshot.movements(), month),
              accounts,
              value,
              debt,
              accounts.add(value).subtract(debt)));
    }
    return result;
  }

  private static BigDecimal total(List<TransactionOccurrence> entries, TransactionType type) {
    return entries.stream()
        .filter(entry -> entry.type() == type)
        .map(TransactionOccurrence::amount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private static BigDecimal invested(List<Movement> movements, YearMonth month) {
    return movements.stream()
        .filter(movement ->
            !movement.isOpening()
                && YearMonth.from(movement.getDate()).equals(month)
                && (movement.getKind() == MovementKind.INVESTMENT
                    || movement.getKind() == MovementKind.REDEMPTION))
        .map(movement ->
            movement.getKind() == MovementKind.REDEMPTION
                ? movement.getAmount().negate()
                : movement.getAmount())
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private static String date(LocalDate date) {
    return date.format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
  }
}
