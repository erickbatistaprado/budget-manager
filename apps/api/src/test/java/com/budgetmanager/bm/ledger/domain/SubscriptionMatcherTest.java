package com.budgetmanager.bm.ledger.domain;

import static org.assertj.core.api.Assertions.*;

import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SubscriptionMatcherTest {
  private static final LocalDate BILL = LocalDate.of(2026, 12, 5);
  private final Card card = Card.builder().id(UUID.randomUUID()).closingDay(25).dueDay(5).build();

  private Transaction series() {
    return Transaction.builder()
        .card(card)
        .repeats(RepeatInterval.MONTHLY)
        .category(Category.builder().transactionType(TransactionType.EXPENSE).build())
        .date(LocalDate.of(2026, 1, 5))
        .notes("Streaming subscription")
        .totalValue(new BigDecimal("30.00"))
        .build();
  }

  private StatementLine line(String description, String amount) {
    return new StatementLine(
        LocalDate.of(2026, 11, 15),
        description,
        new BigDecimal(amount),
        false,
        null,
        null,
        null,
        false);
  }

  @Test
  void matchesAmountWithinFiveCentsOrDescriptionWithDifferentAmount() {
    Transaction series = series();
    assertThat(SubscriptionMatcher.match(List.of(series), card, BILL, line("Unknown", "30.05")))
        .contains(series);
    assertThat(SubscriptionMatcher.match(List.of(series), card, BILL, line("Unknown", "30.06")))
        .isEmpty();
    assertThat(
            SubscriptionMatcher.match(
                List.of(series), card, BILL, line("STREAMING SUBSCRIPTION", "45")))
        .contains(series);
    assertThat(SubscriptionMatcher.billMonth(card, null, line("Streaming subscription", "30")))
        .isEqualTo(YearMonth.of(2026, 12));
  }

  @Test
  void excludesSkippedMonthsOtherCardsAndMonthsOutsideSeries() {
    Transaction series = series();
    series.skipMonth(YearMonth.from(BILL));
    assertThat(
            SubscriptionMatcher.match(
                List.of(series), card, BILL, line("Streaming subscription", "30")))
        .isEmpty();
    series.restoreMonth(YearMonth.from(BILL));
    Card other = Card.builder().id(UUID.randomUUID()).build();
    assertThat(
            SubscriptionMatcher.match(
                List.of(series), other, BILL, line("Streaming subscription", "30")))
        .isEmpty();
    series.endBefore(YearMonth.from(BILL));
    assertThat(
            SubscriptionMatcher.match(
                List.of(series), card, BILL, line("Streaming subscription", "30")))
        .isEmpty();
  }
}
