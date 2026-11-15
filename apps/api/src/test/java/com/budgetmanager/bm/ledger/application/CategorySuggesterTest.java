package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.budgetmanager.bm.ledger.application.CategorySuggester.Source;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CategorySuggesterTest {

  private static final UUID GROCERIES = UUID.randomUUID();
  private static final UUID PETS = UUID.randomUUID();
  private static final UUID SHOPPING = UUID.randomUUID();
  private static final UUID SUBSCRIPTIONS = UUID.randomUUID();
  private static final UUID REFUNDS = UUID.randomUUID();
  private static final UUID HOBBIES = UUID.randomUUID();

  private static final List<Category> CATEGORIES =
      List.of(
          category(GROCERIES, "Groceries", TransactionType.EXPENSE),
          category(PETS, "Pets", TransactionType.EXPENSE),
          category(SHOPPING, "Shopping", TransactionType.EXPENSE),
          category(SUBSCRIPTIONS, "Subscriptions", TransactionType.EXPENSE),
          category(REFUNDS, "Refunds", TransactionType.INCOME),
          category(HOBBIES, "Hobbies", TransactionType.EXPENSE));

  @Test
  void prefersTheExactDescription() {
    CategorySuggester suggester =
        suggester(saved("CORNER MARKET LJ33", GROCERIES, 1), saved("Corner Market", PETS, 2));

    assertThat(suggester.suggest(expense("corner market lj33")))
        .hasValueSatisfying(suggestion -> {
          assertThat(suggestion.source()).isEqualTo(Source.EXACT);
          assertThat(suggestion.categoryId()).isEqualTo(GROCERIES);
        });
  }

  @Test
  void matchesTheSameMerchantWrittenDifferently() {
    CategorySuggester suggester = suggester(saved("SJP BARAO 35", GROCERIES, 1));

    assertThat(suggester.suggest(expense("Sjp Barao")))
        .hasValueSatisfying(suggestion -> {
          assertThat(suggestion.source()).isEqualTo(Source.MERCHANT);
          assertThat(suggestion.categoryId()).isEqualTo(GROCERIES);
          assertThat(suggestion.basis()).isEqualTo("SJP BARAO 35");
        });
  }

  @Test
  void theLatestChoiceWinsSoCorrectionsStick() {
    CategorySuggester suggester =
        suggester(
            saved("Corner Market", GROCERIES, 1),
            saved("Corner Market", GROCERIES, 2),
            saved("Corner Market", HOBBIES, 3));

    assertThat(suggester.suggest(expense("Corner Market")))
        .hasValueSatisfying(suggestion -> {
          assertThat(suggestion.categoryId()).isEqualTo(HOBBIES);
          assertThat(suggestion.count()).isEqualTo(3);
        });
  }

  @Test
  void historyBeatsTheKeywordList() {
    CategorySuggester suggester = suggester(saved("Netflix.Com", HOBBIES, 1));

    assertThat(suggester.suggest(expense("Netflix.Com")).orElseThrow().categoryId())
        .isEqualTo(HOBBIES);
  }

  @Test
  void usesKeywordsForMerchantsNeverSeen() {
    CategorySuggester suggester = suggester();

    assertThat(suggester.suggest(expense("Netflix.Com")))
        .hasValueSatisfying(suggestion -> {
          assertThat(suggestion.source()).isEqualTo(Source.KEYWORD);
          assertThat(suggestion.categoryId()).isEqualTo(SUBSCRIPTIONS);
          assertThat(suggestion.basis()).isEqualTo("netflix");
        });
  }

  @Test
  void skipsKeywordsWhoseCategoryTheUserDeleted() {
    CategorySuggester suggester =
        new CategorySuggester(List.of(), List.of(category(PETS, "Pets", TransactionType.EXPENSE)));

    assertThat(suggester.suggest(expense("Netflix.Com"))).isEmpty();
  }

  @Test
  void findsSimilarMerchantsByTheirFirstWord() {
    CategorySuggester suggester =
        suggester(
            saved("WIDGETCO DOWNTOWN", PETS, 1),
            saved("WIDGETCO AIRPORT", PETS, 2),
            saved("WIDGETCO MALL", GROCERIES, 3));

    assertThat(suggester.suggest(expense("Widgetco Riverside")))
        .hasValueSatisfying(suggestion -> {
          assertThat(suggestion.source()).isEqualTo(Source.SIMILAR);
          assertThat(suggestion.categoryId()).isEqualTo(PETS);
          assertThat(suggestion.count()).isEqualTo(2);
        });
  }

  @Test
  void creditsOnlyGetIncomeCategories() {
    CategorySuggester suggester = suggester(saved("Estorno de \"Shop\"", GROCERIES, 1));

    assertThat(suggester.suggest(credit("Estorno de \"Shop\"")))
        .hasValueSatisfying(suggestion -> {
          assertThat(suggestion.source()).isEqualTo(Source.KEYWORD);
          assertThat(suggestion.categoryId()).isEqualTo(REFUNDS);
        });
  }

  @Test
  void staysEmptyWithoutEvidence() {
    assertThat(suggester(saved("Corner Market", GROCERIES, 1)).suggest(expense("Jc Store")))
        .isEmpty();
  }

  private static CategorySuggester suggester(ExistingTransaction... saved) {
    return new CategorySuggester(List.of(saved), CATEGORIES);
  }

  private static ExistingTransaction saved(String notes, UUID categoryId, int order) {
    TransactionType type =
        categoryId.equals(REFUNDS) ? TransactionType.INCOME : TransactionType.EXPENSE;
    return new ExistingTransaction(
        UUID.randomUUID(),
        notes,
        LocalDate.of(2026, 1, 1),
        BigDecimal.TEN,
        null,
        categoryId,
        type,
        Instant.parse("2026-01-01T00:00:00Z").plusSeconds(order));
  }

  private static StatementLine expense(String description) {
    return new StatementLine(
        LocalDate.of(2026, 2, 1), description, BigDecimal.ONE, false, null, null, null);
  }

  private static StatementLine credit(String description) {
    return new StatementLine(
        LocalDate.of(2026, 2, 1), description, BigDecimal.ONE, true, null, null, null);
  }

  private static Category category(UUID id, String name, TransactionType type) {
    return Category.builder().id(id).name(name).transactionType(type).build();
  }
}
