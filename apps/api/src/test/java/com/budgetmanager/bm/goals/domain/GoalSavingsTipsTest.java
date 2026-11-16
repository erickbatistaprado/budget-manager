package com.budgetmanager.bm.goals.domain;

import static org.assertj.core.api.Assertions.*;

import com.budgetmanager.bm.ledger.domain.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class GoalSavingsTipsTest {
  private static final YearMonth MONTH = YearMonth.of(2026, 10);

  private Category category(String name, boolean fixed) {
    return Category.builder()
        .id(UUID.randomUUID())
        .name(name)
        .transactionType(TransactionType.EXPENSE)
        .fixedCost(fixed)
        .build();
  }

  private Transaction expense(Category category, YearMonth month, String amount) {
    return Transaction.builder()
        .category(category)
        .date(month.atDay(10))
        .totalValue(new BigDecimal(amount))
        .repeats(RepeatInterval.NONE)
        .build();
  }

  @Test
  void excludesFixedMonthlyAndFinancingOrdersTopThreeAndProjectsMonthsGained() {
    var delivery = category("Delivery", false);
    List<Transaction> transactions = new ArrayList<>();
    for (int offset = 1; offset <= 6; offset++) {
      transactions.add(expense(delivery, MONTH.minusMonths(offset), "600"));
    }
    transactions.add(expense(delivery, MONTH, "900"));
    transactions.add(expense(category("Fixed", true), MONTH, "9000"));
    var rent = expense(category("Rent", false), MONTH, "9000");
    rent.setRepeats(RepeatInterval.MONTHLY);
    transactions.add(rent);
    var financing = expense(category("Car", false), MONTH, "9000");
    financing.setFinancingId(UUID.randomUUID());
    transactions.add(financing);
    transactions.add(expense(category("Games", false), MONTH, "200"));
    transactions.add(expense(category("Coffee", false), MONTH, "100"));
    transactions.add(expense(category("Books", false), MONTH, "50"));
    var goal =
        new GoalFunding.Item(
            UUID.randomUUID(), new BigDecimal("1200"), BigDecimal.ZERO, null, null);
    var tips =
        GoalSavingsTips.calculate(
            transactions,
            MONTH,
            List.of(goal),
            new BigDecimal("300"),
            MONTH.plusMonths(1),
            "Keyboard");
    assertThat(tips)
        .extracting(GoalSavingsTips.Tip::category)
        .containsExactly("Delivery", "Games", "Coffee");
    assertThat(tips.getFirst().average()).isEqualByComparingTo("600");
    assertThat(tips.getFirst().difference()).isEqualByComparingTo("300");
    assertThat(tips.getFirst().percentAbove()).isEqualByComparingTo("50");
    assertThat(tips.getFirst().monthsGained()).isEqualTo(2L);
    assertThat(tips.get(1).percentAbove()).isNull();
  }

  @Test
  void countsACardPurchaseInTheMonthItWasMadeNotWhenItsBillIsDue() {
    var restaurants = category("Restaurants", false);
    List<Transaction> transactions = new ArrayList<>();
    for (int offset = 1; offset <= 6; offset++) {
      transactions.add(expense(restaurants, MONTH.minusMonths(offset), "400"));
    }
    var dinner = expense(restaurants, MONTH, "1500");
    dinner.setPaymentMethod(PaymentMethod.CREDIT_CARD);
    dinner.setBillDueDate(MONTH.plusMonths(1).atDay(7));
    transactions.add(dinner);
    var tips =
        GoalSavingsTips.calculate(transactions, MONTH, List.of(), BigDecimal.ZERO, MONTH, null);
    assertThat(tips.getFirst().amount()).isEqualByComparingTo("1500");
    assertThat(tips.getFirst().difference()).isEqualByComparingTo("1100");
  }

  @Test
  void zeroPaceAndNoGoalHaveNoInventedMonthsGained() {
    var transactions = List.of(expense(category("Delivery", false), MONTH, "100"));
    var tips =
        GoalSavingsTips.calculate(transactions, MONTH, List.of(), BigDecimal.ZERO, MONTH, null);
    assertThat(tips.getFirst().goalId()).isNull();
    assertThat(tips.getFirst().monthsGained()).isNull();
  }
}
