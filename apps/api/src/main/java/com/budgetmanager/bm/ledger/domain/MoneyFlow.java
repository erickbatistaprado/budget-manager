package com.budgetmanager.bm.ledger.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

public final class MoneyFlow {
  private MoneyFlow() {}

  public record Bill(
      UUID cardId,
      String cardName,
      LocalDate dueDate,
      BigDecimal total,
      UUID paymentAccountId,
      UUID fundingAccountId) {
    public Bill(Card card, LocalDate dueDate, BigDecimal total) {
      this(
          card.getId(),
          card.getName(),
          dueDate,
          total,
          card.getPaymentAccount() == null ? null : card.getPaymentAccount().getId(),
          card.getFundingAccount() == null ? null : card.getFundingAccount().getId());
    }
  }

  /**
   * One bill per card and month. Installments keep the due day the card had when they were bought,
   * so a month can carry two due dates after the bank moves the due day; the bill takes the date
   * that carries most of its amount.
   */
  public static List<Bill> bills(List<TransactionOccurrence> entries, List<Card> cards) {
    Map<UUID, Map<YearMonth, Map<LocalDate, BigDecimal>>> totals = new HashMap<>();
    entries.stream()
        .filter(entry -> entry.cardId() != null)
        .forEach(entry ->
            totals
                .computeIfAbsent(entry.cardId(), ignored -> new TreeMap<>())
                .computeIfAbsent(YearMonth.from(entry.date()), ignored -> new TreeMap<>())
                .merge(
                    entry.date(),
                    entry.type() == TransactionType.EXPENSE
                        ? entry.amount()
                        : entry.amount().negate(),
                    BigDecimal::add));
    List<Bill> bills = new ArrayList<>();
    cards.forEach(card ->
        totals
            .getOrDefault(card.getId(), Map.of())
            .values()
            .forEach(dates -> bills.add(new Bill(card, mainDueDate(dates), sum(dates)))));
    return bills;
  }

  private static LocalDate mainDueDate(Map<LocalDate, BigDecimal> dates) {
    return dates.entrySet().stream()
        .max(
            Comparator.comparing((Map.Entry<LocalDate, BigDecimal> date) -> date.getValue().abs())
                .thenComparing(Map.Entry::getKey))
        .orElseThrow()
        .getKey();
  }

  private static BigDecimal sum(Map<LocalDate, BigDecimal> dates) {
    return dates.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  public static List<Movement> movements(
      List<Movement> stored, List<Bill> bills, LocalDate firstTransaction) {
    List<Movement> result = new ArrayList<>(stored);
    if (firstTransaction == null) {
      return result;
    }
    for (Bill bill : bills) {
      if (bill.paymentAccountId() == null
          || bill.total().signum() <= 0
          || bill.dueDate().isBefore(firstTransaction)) {
        continue;
      }
      boolean payment =
          stored.stream()
              .anyMatch(movement ->
                  sameBill(movement, bill) && movement.getKind() == MovementKind.CARD_BILL_PAYMENT);
      boolean funding =
          stored.stream()
              .anyMatch(movement ->
                  sameBill(movement, bill) && movement.getKind() == MovementKind.TRANSFER);
      if (!payment) {
        result.add(derived(bill, MovementKind.CARD_BILL_PAYMENT, bill.paymentAccountId(), null));
      }
      if (!funding && bill.fundingAccountId() != null) {
        result.add(
            derived(bill, MovementKind.TRANSFER, bill.fundingAccountId(), bill.paymentAccountId()));
      }
    }
    result.sort(Comparator.comparing(Movement::getDate).thenComparing(Movement::getKind));
    return result;
  }

  public static boolean sameBill(Movement movement, Bill bill) {
    return bill.cardId().equals(movement.getCardId())
        && movement.getBillDueDate() != null
        && YearMonth.from(bill.dueDate()).equals(YearMonth.from(movement.getBillDueDate()));
  }

  private static Movement derived(Bill bill, MovementKind kind, UUID from, UUID to) {
    return Movement.builder()
        .kind(kind)
        .date(bill.dueDate())
        .amount(bill.total())
        .fromAccountId(from)
        .toAccountId(to)
        .cardId(bill.cardId())
        .billDueDate(bill.dueDate())
        .automatic(true)
        .build();
  }

  public static Optional<AccountBalance> checkpoint(
      List<AccountBalance> checkpoints, UUID accountId, LocalDate date) {
    return checkpoints.stream()
        .filter(checkpoint ->
            accountId.equals(checkpoint.getAccountId()) && !checkpoint.getDate().isAfter(date))
        .max(Comparator.comparing(AccountBalance::getDate));
  }

  /**
   * The account's balance at the end of a day: from the latest checkpoint on or before it plus the
   * flows after it; before the first checkpoint, from the first checkpoint minus the flows in
   * between, so one known balance (today's, say) is enough to see every month; with no checkpoint
   * at all, from zero.
   */
  public static BigDecimal balance(
      UUID accountId,
      LocalDate date,
      List<AccountBalance> checkpoints,
      List<TransactionOccurrence> entries,
      List<Movement> movements) {
    var checkpoint = checkpoint(checkpoints, accountId, date);
    if (checkpoint.isEmpty()) {
      var first =
          checkpoints.stream()
              .filter(candidate -> accountId.equals(candidate.getAccountId()))
              .min(Comparator.comparing(AccountBalance::getDate));
      if (first.isPresent()) {
        return first
            .get()
            .getBalance()
            .subtract(flows(accountId, date, first.get().getDate(), entries, movements));
      }
    }
    LocalDate after = checkpoint.map(AccountBalance::getDate).orElse(LocalDate.MIN);
    BigDecimal value = checkpoint.map(AccountBalance::getBalance).orElse(BigDecimal.ZERO);
    return value.add(flows(accountId, after, date, entries, movements));
  }

  /** What moved in or out of the account after {@code after} up to and including {@code until}. */
  private static BigDecimal flows(
      UUID accountId,
      LocalDate after,
      LocalDate until,
      List<TransactionOccurrence> entries,
      List<Movement> movements) {
    BigDecimal fromEntries =
        entries.stream()
            .filter(entry ->
                accountId.equals(entry.accountId())
                    && entry.date().isAfter(after)
                    && !entry.date().isAfter(until))
            .map(TransactionOccurrence::accountEffect)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return fromEntries.add(
        movements.stream()
            .filter(
                movement -> movement.getDate().isAfter(after) && !movement.getDate().isAfter(until))
            .map(movement -> movement.effectOn(accountId))
            .reduce(BigDecimal.ZERO, BigDecimal::add));
  }
}
