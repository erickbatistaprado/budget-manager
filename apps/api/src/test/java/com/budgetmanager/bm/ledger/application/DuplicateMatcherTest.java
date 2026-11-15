package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DuplicateMatcherTest {

  private static final LocalDate PURCHASE = LocalDate.of(2026, 2, 5);
  private static final UUID CATEGORY = UUID.randomUUID();

  @Test
  void matchesTheSamePurchaseWhenAnotherBillCutsTheNameLonger() {
    ExistingTransaction saved = purchase("LANGUAGE SCHOOL I", PURCHASE, "7619.37", 11);

    DuplicateMatcher matcher = new DuplicateMatcher(List.of(saved));

    assertThat(matcher.match(0, line("LANGUAGE SCHOOL ING", PURCHASE, "692.67", 10, 11), null))
        .extracting(DuplicateMatcher.Match::transactionId)
        .isEqualTo(saved.id());
  }

  @Test
  void matchesWhenTheBankPutsTheLeftoverCentsOnTheFirstInstallment() {
    ExistingTransaction saved = purchase("PHARMACY CHAIN E P", PURCHASE, "758.24", 4);

    DuplicateMatcher matcher = new DuplicateMatcher(List.of(saved));

    assertThat(matcher.match(0, line("PHARMACY CHAIN E PER", PURCHASE, "189.54", 2, 4), null))
        .extracting(DuplicateMatcher.Match::transactionId)
        .isEqualTo(saved.id());
    assertThat(matcher.findPurchase(line("PHARMACY CHAIN E PER", PURCHASE, "189.54", 2, 4)))
        .contains(saved);
  }

  @Test
  void keepsApartPurchasesThatOnlyLookAlike() {
    DuplicateMatcher matcher =
        new DuplicateMatcher(
            List.of(
                purchase("LANGUAGE SCHOOL I", PURCHASE, "7619.37", 11),
                purchase("UBER", PURCHASE, "100.00", 4)));

    assertThat(
            matcher.match(
                0, line("LANGUAGE SCHOOL ING", PURCHASE.plusDays(1), "692.67", 10, 11), null))
        .as("another purchase date")
        .isNull();
    assertThat(matcher.match(1, line("LANGUAGE SCHOOL ING", PURCHASE, "692.67", 10, 12), null))
        .as("another number of installments")
        .isNull();
    assertThat(matcher.match(2, line("LANGUAGE SCHOOL ING", PURCHASE, "700.00", 10, 11), null))
        .as("another amount")
        .isNull();
    assertThat(matcher.match(3, line("UBER EATS", PURCHASE, "25.00", 2, 4), null))
        .as("a prefix too short to trust")
        .isNull();
  }

  @Test
  void stillRequiresTheChosenCategory() {
    ExistingTransaction saved = purchase("LANGUAGE SCHOOL I", PURCHASE, "7619.37", 11);

    DuplicateMatcher matcher = new DuplicateMatcher(List.of(saved));

    assertThat(
            matcher.match(
                0, line("LANGUAGE SCHOOL ING", PURCHASE, "692.67", 10, 11), UUID.randomUUID()))
        .isNull();
  }

  private static ExistingTransaction purchase(
      String notes, LocalDate date, String total, int installments) {
    return new ExistingTransaction(
        UUID.randomUUID(),
        notes,
        date,
        new BigDecimal(total),
        installments,
        CATEGORY,
        TransactionType.EXPENSE,
        Instant.parse("2026-11-01T00:00:00Z"));
  }

  private static StatementLine line(
      String description, LocalDate date, String amount, int number, int total) {
    return new StatementLine(
        date, description, new BigDecimal(amount), false, number, total, "ALEX ••1111", false);
  }
}
