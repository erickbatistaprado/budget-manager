package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.domain.statement.MerchantKeywords;
import com.budgetmanager.bm.ledger.domain.statement.MerchantText;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Suggests a category for a statement line, from the strongest evidence to the weakest:
 *
 * <ol>
 *   <li>{@link Source#EXACT}: a saved transaction with the same description;
 *   <li>{@link Source#MERCHANT}: the same merchant written differently, such as {@code "SJP BARAO
 *       35"} and {@code "Sjp Barao"};
 *   <li>{@link Source#KEYWORD}: a well-known merchant or word from {@link MerchantKeywords};
 *   <li>{@link Source#SIMILAR}: saved transactions starting with the same merchant word, or sharing
 *       most of their words; the category used most often among them wins.
 * </ol>
 *
 * <p>For the first two, the most recently saved transaction wins, so a correction takes effect on
 * the next import. Everything runs on the user's own data and a built-in word list.
 */
final class CategorySuggester {

  enum Source {
    EXACT,
    MERCHANT,
    KEYWORD,
    SIMILAR
  }

  record Suggestion(UUID categoryId, Source source, String basis, int count) {}

  private static final double SIMILAR_WORDS = 0.5;
  private static final int DISTINCTIVE_WORD = 4;

  private record Candidate(
      ExistingTransaction transaction, String merchantKey, Set<String> words) {}

  private final Map<TransactionType, Map<String, List<Candidate>>> byDescription = new HashMap<>();
  private final Map<TransactionType, Map<String, List<Candidate>>> byMerchant = new HashMap<>();
  private final Map<TransactionType, List<Candidate>> candidates = new HashMap<>();
  private final Map<TransactionType, Map<String, UUID>> categoryIdsByName = new HashMap<>();

  CategorySuggester(List<ExistingTransaction> existing, List<Category> categories) {
    for (ExistingTransaction transaction : existing) {
      List<String> words = MerchantText.significantWords(transaction.notes());
      Candidate candidate =
          new Candidate(transaction, String.join(" ", words), new HashSet<>(words));
      TransactionType type = transaction.transactionType();
      byDescription
          .computeIfAbsent(type, ignored -> new HashMap<>())
          .computeIfAbsent(
              StatementText.normalize(transaction.notes()), ignored -> new ArrayList<>())
          .add(candidate);
      if (!candidate.merchantKey().isEmpty()) {
        byMerchant
            .computeIfAbsent(type, ignored -> new HashMap<>())
            .computeIfAbsent(candidate.merchantKey(), ignored -> new ArrayList<>())
            .add(candidate);
      }
      candidates.computeIfAbsent(type, ignored -> new ArrayList<>()).add(candidate);
    }
    for (Category category : categories) {
      categoryIdsByName
          .computeIfAbsent(category.getTransactionType(), ignored -> new HashMap<>())
          .put(category.getName().toLowerCase(Locale.ROOT), category.getId());
    }
  }

  Optional<Suggestion> suggest(StatementLine line) {
    TransactionType type = line.credit() ? TransactionType.INCOME : TransactionType.EXPENSE;
    String description = StatementText.normalize(line.description());
    List<String> words = MerchantText.significantWords(line.description());
    String merchantKey = String.join(" ", words);

    List<Candidate> exact = byDescription.getOrDefault(type, Map.of()).get(description);
    if (exact != null) {
      return Optional.of(latest(exact, Source.EXACT));
    }
    List<Candidate> sameMerchant =
        merchantKey.isEmpty() ? null : byMerchant.getOrDefault(type, Map.of()).get(merchantKey);
    if (sameMerchant != null) {
      return Optional.of(latest(sameMerchant, Source.MERCHANT));
    }
    Optional<Suggestion> keyword = keyword(line.description(), type);
    if (keyword.isPresent()) {
      return keyword;
    }
    return similar(words, type);
  }

  private Optional<Suggestion> keyword(String description, TransactionType type) {
    return MerchantKeywords.match(description, type)
        .flatMap(match ->
            Optional.ofNullable(
                    categoryIdsByName
                        .getOrDefault(type, Map.of())
                        .get(match.categoryName().toLowerCase(Locale.ROOT)))
                .map(categoryId -> new Suggestion(categoryId, Source.KEYWORD, match.keyword(), 0)));
  }

  private Optional<Suggestion> similar(List<String> words, TransactionType type) {
    if (words.isEmpty()) {
      return Optional.empty();
    }
    Set<String> wordSet = new HashSet<>(words);
    String first = words.getFirst();
    Map<UUID, List<Candidate>> byCategory = new HashMap<>();
    for (Candidate candidate : candidates.getOrDefault(type, List.of())) {
      if (candidate.words().isEmpty()) {
        continue;
      }
      boolean sameFirstWord =
          first.length() >= DISTINCTIVE_WORD && candidate.merchantKey().split(" ")[0].equals(first);
      if (sameFirstWord || overlap(wordSet, candidate.words()) >= SIMILAR_WORDS) {
        byCategory
            .computeIfAbsent(candidate.transaction().categoryId(), ignored -> new ArrayList<>())
            .add(candidate);
      }
    }
    return byCategory.values().stream()
        .max(
            Comparator.<List<Candidate>>comparingInt(List::size)
                .thenComparing(group -> newest(group).orElse(Instant.EPOCH)))
        .map(group -> latest(group, Source.SIMILAR));
  }

  private static double overlap(Set<String> left, Set<String> right) {
    Set<String> shared = new HashSet<>(left);
    shared.retainAll(right);
    if (shared.stream().noneMatch(word -> word.length() >= DISTINCTIVE_WORD)) {
      return 0;
    }
    Set<String> union = new HashSet<>(left);
    union.addAll(right);
    return (double) shared.size() / union.size();
  }

  private static Suggestion latest(List<Candidate> group, Source source) {
    ExistingTransaction transaction =
        group.stream()
            .map(Candidate::transaction)
            .max(Comparator.comparing(CategorySuggester::savedAt))
            .orElseThrow();
    return new Suggestion(transaction.categoryId(), source, transaction.notes(), group.size());
  }

  private static Optional<Instant> newest(List<Candidate> group) {
    return group.stream()
        .map(Candidate::transaction)
        .map(CategorySuggester::savedAt)
        .max(Comparator.naturalOrder());
  }

  private static Instant savedAt(ExistingTransaction transaction) {
    return transaction.createdAt() != null
        ? transaction.createdAt()
        : transaction.date().atStartOfDay().toInstant(ZoneOffset.UTC);
  }
}
