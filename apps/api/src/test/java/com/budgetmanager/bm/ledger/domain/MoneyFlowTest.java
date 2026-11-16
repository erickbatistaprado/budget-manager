package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class MoneyFlowTest {
  private static final LocalDate JAN = LocalDate.of(2026, 1, 5);
  private static final UUID FROM = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID TO = UUID.fromString("00000000-0000-0000-0000-000000000002");

  private static Movement movement(MovementKind kind) {
    return Movement.builder().kind(kind).date(JAN).amount(new BigDecimal("100")).build();
  }

  private static Card card() {
    return Card.builder()
        .id(UUID.fromString("00000000-0000-0000-0000-000000000003"))
        .paymentAccount(Account.builder().id(TO).build())
        .fundingAccount(Account.builder().id(FROM).build())
        .build();
  }

  @Test
  void movementKindsRequireExactlyTheirOwnReferences() {
    for (MovementKind kind : MovementKind.values()) {
      Movement draft = movement(kind);
      assertThatThrownBy(draft::validate).isInstanceOf(IllegalArgumentException.class);
      switch (kind) {
        case TRANSFER -> {
          draft.setFromAccountId(FROM);
          draft.setToAccountId(TO);
        }
        case CARD_BILL_PAYMENT -> {
          draft.setFromAccountId(FROM);
          draft.setCardId(card().getId());
          draft.setBillDueDate(JAN);
        }
        case INVESTMENT -> {
          draft.setSavingId(TO);
          draft.setFromAccountId(FROM);
        }
        case REDEMPTION -> {
          draft.setSavingId(FROM);
          draft.setToAccountId(TO);
        }
      }
      assertThatCode(draft::validate).doesNotThrowAnyException();
      draft.setAmount(BigDecimal.ZERO);
      assertThatThrownBy(draft::validate).isInstanceOf(IllegalArgumentException.class);
    }
  }

  @Test
  void openingInvestmentCannotTakeMoneyFromAnAccount() {
    Movement opening = movement(MovementKind.INVESTMENT);
    opening.setSavingId(TO);
    opening.setOpening(true);
    assertThatCode(opening::validate).doesNotThrowAnyException();
    opening.setFromAccountId(FROM);
    assertThatThrownBy(opening::validate).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void transferRejectsSameAccountAndPartialBillLink() {
    Movement transfer = movement(MovementKind.TRANSFER);
    transfer.setFromAccountId(FROM);
    transfer.setToAccountId(FROM);
    assertThatThrownBy(transfer::validate).isInstanceOf(IllegalArgumentException.class);
    transfer.setToAccountId(TO);
    transfer.setCardId(card().getId());
    assertThatThrownBy(transfer::validate).isInstanceOf(IllegalArgumentException.class);
    transfer.setBillDueDate(JAN);
    assertThatCode(transfer::validate).doesNotThrowAnyException();
  }

  @Test
  void billTotalsUseInstallmentsAndSubtractCardCredits() {
    Card card = card();
    Transaction purchase =
        Transaction.builder()
            .card(card)
            .category(Category.builder().transactionType(TransactionType.EXPENSE).build())
            .date(JAN.minusMonths(1))
            .billDueDate(JAN)
            .totalValue(new BigDecimal("300"))
            .installmentNumbers(3)
            .repeats(RepeatInterval.NONE)
            .build();
    purchase.scheduleInstallments();
    List<TransactionOccurrence> entries =
        new ArrayList<>(TransactionOccurrence.expand(purchase, JAN));
    entries.add(
        new TransactionOccurrence(
            JAN,
            new BigDecimal("20"),
            TransactionType.INCOME,
            null,
            card.getId(),
            PaymentMethod.CREDIT_CARD));
    assertThat(MoneyFlow.bills(entries, List.of(card)))
        .singleElement()
        .satisfies(bill -> assertThat(bill.total()).isEqualByComparingTo("80"));
  }

  @Test
  void aMonthWithTwoDueDatesIsOneBillOnTheDateCarryingMostOfIt() {
    Card card = card();
    LocalDate oldDueDay = LocalDate.of(2026, 7, 8);
    LocalDate newDueDay = LocalDate.of(2026, 7, 5);
    List<TransactionOccurrence> entries =
        List.of(
            occurrence(card, oldDueDay, "30"),
            occurrence(card, newDueDay, "500"),
            occurrence(card, newDueDay, "70"),
            occurrence(card, LocalDate.of(2026, 8, 5), "40"));
    assertThat(MoneyFlow.bills(entries, List.of(card)))
        .extracting(MoneyFlow.Bill::dueDate, bill -> bill.total().toPlainString())
        .containsExactly(tuple(newDueDay, "600"), tuple(LocalDate.of(2026, 8, 5), "40"));
  }

  @Test
  void aPaymentRecordedForAnyDayOfTheBillMonthReplacesTheAutomaticOne() {
    Card card = card();
    var bill = new MoneyFlow.Bill(card, LocalDate.of(2026, 7, 5), new BigDecimal("100"));
    Movement payment = movement(MovementKind.CARD_BILL_PAYMENT);
    payment.setCardId(card.getId());
    payment.setBillDueDate(LocalDate.of(2026, 7, 8));
    assertThat(MoneyFlow.sameBill(payment, bill)).isTrue();
    payment.setBillDueDate(LocalDate.of(2026, 8, 5));
    assertThat(MoneyFlow.sameBill(payment, bill)).isFalse();
  }

  private static TransactionOccurrence occurrence(Card card, LocalDate date, String amount) {
    return new TransactionOccurrence(
        date,
        new BigDecimal(amount),
        TransactionType.EXPENSE,
        null,
        card.getId(),
        PaymentMethod.CREDIT_CARD);
  }

  @Test
  void recordedPaymentAndExplicitFundingReplaceOnlyTheirOwnAutomaticMovement() {
    Card card = card();
    var bill = new MoneyFlow.Bill(card, JAN, new BigDecimal("100"));
    var automatic = MoneyFlow.movements(List.of(), List.of(bill), JAN.minusMonths(1));
    assertThat(automatic)
        .hasSize(2)
        .allMatch(Movement::isAutomatic)
        .allMatch(movement -> movement.getId() == null);
    Movement payment = movement(MovementKind.CARD_BILL_PAYMENT);
    payment.setCardId(card.getId());
    payment.setBillDueDate(JAN);
    payment.setFromAccountId(TO);
    payment.setDate(JAN.minusDays(1));
    payment.setAmount(new BigDecimal("95"));
    var replaced = MoneyFlow.movements(List.of(payment), List.of(bill), JAN.minusMonths(1));
    assertThat(replaced)
        .hasSize(2)
        .filteredOn(Movement::isAutomatic)
        .singleElement()
        .satisfies(movement -> {
          assertThat(movement.getKind()).isEqualTo(MovementKind.TRANSFER);
          assertThat(movement.getAmount()).isEqualByComparingTo("100");
        });
    Movement funding = movement(MovementKind.TRANSFER);
    funding.setCardId(card.getId());
    funding.setBillDueDate(JAN);
    funding.setFromAccountId(FROM);
    funding.setToAccountId(TO);
    assertThat(MoneyFlow.movements(List.of(payment, funding), List.of(bill), JAN.minusMonths(1)))
        .hasSize(2)
        .noneMatch(Movement::isAutomatic);
    funding.setCardId(null);
    funding.setBillDueDate(null);
    assertThat(MoneyFlow.movements(List.of(payment, funding), List.of(bill), JAN.minusMonths(1)))
        .hasSize(3);
  }

  @Test
  void zeroNegativeAndPrehistoryBillsDoNotDerivePayments() {
    for (BigDecimal total : List.of(BigDecimal.ZERO, BigDecimal.ONE.negate())) {
      assertThat(
              MoneyFlow.movements(
                  List.of(), List.of(new MoneyFlow.Bill(card(), JAN, total)), JAN.minusDays(1)))
          .isEmpty();
    }
    assertThat(
            MoneyFlow.movements(
                List.of(),
                List.of(new MoneyFlow.Bill(card(), JAN, BigDecimal.TEN)),
                JAN.plusDays(1)))
        .isEmpty();
  }

  @Test
  void checkpointsAreEndOfDayAndCardPurchasesNeverDebitAccounts() {
    AccountBalance checkpoint = new AccountBalance();
    checkpoint.setAccountId(FROM);
    checkpoint.setDate(JAN);
    checkpoint.setBalance(new BigDecimal("500"));
    List<TransactionOccurrence> entries =
        List.of(
            new TransactionOccurrence(
                JAN.minusDays(1),
                BigDecimal.TEN,
                TransactionType.INCOME,
                FROM,
                null,
                PaymentMethod.PIX),
            new TransactionOccurrence(
                JAN, BigDecimal.TEN, TransactionType.EXPENSE, FROM, null, PaymentMethod.PIX),
            new TransactionOccurrence(
                JAN.plusDays(1),
                BigDecimal.TEN,
                TransactionType.EXPENSE,
                FROM,
                null,
                PaymentMethod.BOLETO),
            new TransactionOccurrence(
                JAN.plusDays(1),
                new BigDecimal("999"),
                TransactionType.EXPENSE,
                FROM,
                card().getId(),
                PaymentMethod.CREDIT_CARD));
    assertThat(MoneyFlow.balance(FROM, JAN.minusDays(1), List.of(checkpoint), entries, List.of()))
        .isEqualByComparingTo("10");
    assertThat(MoneyFlow.balance(FROM, JAN, List.of(checkpoint), entries, List.of()))
        .isEqualByComparingTo("500");
    Movement transfer = movement(MovementKind.TRANSFER);
    transfer.setDate(JAN.plusDays(1));
    transfer.setFromAccountId(FROM);
    transfer.setToAccountId(TO);
    assertThat(
            MoneyFlow.balance(
                FROM, JAN.plusDays(1), List.of(checkpoint), entries, List.of(transfer)))
        .isEqualByComparingTo("390");
    assertThat(
            MoneyFlow.balance(TO, JAN.plusDays(1), List.of(checkpoint), entries, List.of(transfer)))
        .isEqualByComparingTo("100");
  }

  @Test
  void monthlyExpansionReusesOverridesSkipsAndClampedDates() {
    Transaction series =
        Transaction.builder()
            .date(LocalDate.of(2026, 1, 31))
            .category(Category.builder().transactionType(TransactionType.EXPENSE).build())
            .account(Account.builder().id(FROM).build())
            .paymentMethod(PaymentMethod.PIX)
            .repeats(RepeatInterval.MONTHLY)
            .totalValue(new BigDecimal("100"))
            .build();
    series.changeMonth(
        YearMonth.of(2026, 2), new BigDecimal("150"), LocalDate.of(2026, 2, 20), "changed");
    series.skipMonth(YearMonth.of(2026, 3));
    var entries = TransactionOccurrence.expand(series, LocalDate.of(2026, 4, 30));
    assertThat(entries)
        .extracting(TransactionOccurrence::date)
        .containsExactly(
            LocalDate.of(2026, 1, 31), LocalDate.of(2026, 2, 20), LocalDate.of(2026, 4, 30));
    assertThat(MoneyFlow.balance(FROM, LocalDate.of(2026, 4, 30), List.of(), entries, List.of()))
        .isEqualByComparingTo("-350");
  }

  @Test
  void financingUsesExplicitInstallmentAmountsAndDueDates() {
    Transaction loan =
        Transaction.builder()
            .account(Account.builder().id(FROM).build())
            .paymentMethod(PaymentMethod.BOLETO)
            .category(Category.builder().transactionType(TransactionType.EXPENSE).build())
            .date(JAN)
            .source("FINANCING")
            .financingId(TO)
            .installmentNumbers(2)
            .totalValue(new BigDecimal("210"))
            .build();
    loan.getInstallments()
        .add(Installment.builder().dueDate(JAN).amount(new BigDecimal("110")).build());
    loan.getInstallments()
        .add(
            Installment.builder().dueDate(JAN.plusMonths(1)).amount(new BigDecimal("100")).build());
    assertThat(
            MoneyFlow.balance(
                FROM, JAN, List.of(), TransactionOccurrence.expand(loan, JAN), List.of()))
        .isEqualByComparingTo("-110");
  }

  @Test
  void statementMatcherRequiresUniqueAccountAmountAndNearbyDate() {
    Movement payment = movement(MovementKind.CARD_BILL_PAYMENT);
    payment.setFromAccountId(FROM);
    assertThat(
            BillPaymentMatcher.match(
                List.of(payment), FROM, JAN.plusDays(3), new BigDecimal("-100"), "Card bill"))
        .contains(payment);
    assertThat(
            BillPaymentMatcher.match(
                List.of(payment), TO, JAN, BigDecimal.valueOf(100), "Card bill"))
        .isEmpty();
    assertThat(
            BillPaymentMatcher.match(
                List.of(payment), FROM, JAN.plusDays(4), BigDecimal.valueOf(100), "Card bill"))
        .isEmpty();
    assertThat(
            BillPaymentMatcher.match(
                List.of(payment, payment), FROM, JAN, BigDecimal.valueOf(100), "Card bill"))
        .isEmpty();
  }
}
