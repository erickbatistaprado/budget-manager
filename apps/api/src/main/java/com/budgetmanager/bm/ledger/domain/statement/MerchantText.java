package com.budgetmanager.bm.ledger.domain.statement;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * Turns card descriptors into comparable merchant names. Statements print the same shop in
 * different ways ({@code "SJP BARAO 35"}, {@code "Sjp Barao"}), so store numbers, company suffixes
 * and punctuation are dropped before comparing.
 */
public final class MerchantText {

  private static final Set<String> NOISE =
      Set.of(
          "ltda",
          "sa",
          "s/a",
          "me",
          "eireli",
          "epp",
          "cia",
          "de",
          "da",
          "do",
          "das",
          "dos",
          "e",
          "the",
          "com",
          "br",
          "nupay",
          "antecipada",
          "pagamento",
          "compra");

  private MerchantText() {}

  /** Every word of the description, lower case and without accents or punctuation. */
  public static List<String> words(String description) {
    String normalized = StatementText.normalize(description).replaceAll("[^a-z0-9&]+", " ");
    return Arrays.stream(normalized.strip().split(" ")).filter(word -> !word.isEmpty()).toList();
  }

  /** Words that identify the merchant: no numbers, company suffixes or filler words. */
  public static List<String> significantWords(String description) {
    return words(description).stream()
        .filter(word -> word.chars().noneMatch(Character::isDigit))
        .filter(word -> word.length() >= 2 && !NOISE.contains(word))
        .toList();
  }

  /** The same key for the same merchant across statements and banks. */
  public static String merchantKey(String description) {
    return String.join(" ", significantWords(description));
  }
}
