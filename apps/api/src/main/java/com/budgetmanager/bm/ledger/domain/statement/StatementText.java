package com.budgetmanager.bm.ledger.domain.statement;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Text rules shared by every statement format. */
public final class StatementText {

  public static final int MAX_DESCRIPTION_LENGTH = 255;

  private static final Pattern NUBANK_INSTALLMENT =
      Pattern.compile(
          "^(?:Antecipada\\s*-\\s*)?(.+?)\\s*-\\s*Parcela\\s+(\\d{1,3})\\s*/\\s*(\\d{1,3})$",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern TRAILING_INSTALLMENT =
      Pattern.compile("^(.+?)\\s+(\\d{1,3})\\s*/\\s*(\\d{1,3})$");
  private static final Pattern BRAZILIAN_AMOUNT =
      Pattern.compile("^([-−])?\\s*(?:R\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*|\\d+),(\\d{2})$");
  private static final Pattern MARKS = Pattern.compile("\\p{M}+");

  private StatementText() {}

  public record Installment(String purchase, int number, int total) {}

  /**
   * Finds an installment suffix such as {@code "Shop - Parcela 3/10"} (NuBank) or {@code "SHOP
   * 3/10"} (Bradesco). A suffix is only accepted when the number is between 1 and the total.
   */
  public static Optional<Installment> installment(String description) {
    for (Pattern pattern : new Pattern[] {NUBANK_INSTALLMENT, TRAILING_INSTALLMENT}) {
      Matcher matcher = pattern.matcher(description.strip());
      if (matcher.matches()) {
        int number = Integer.parseInt(matcher.group(2));
        int total = Integer.parseInt(matcher.group(3));
        if (number >= 1 && number <= total && total >= 2) {
          return Optional.of(new Installment(matcher.group(1).strip(), number, total));
        }
      }
    }
    return Optional.empty();
  }

  /** Lower case, no accents, single spaces: how descriptions are compared for duplicates. */
  public static String normalize(String description) {
    if (description == null) {
      return "";
    }
    String withoutMarks =
        MARKS.matcher(Normalizer.normalize(description, Normalizer.Form.NFD)).replaceAll("");
    return withoutMarks.toLowerCase(Locale.ROOT).strip().replaceAll("\\s+", " ");
  }

  /** Parses {@code "1.612,50"}, {@code "R$ 7,95"}, {@code "−R$ 40,26"} or {@code "- 93,69"}. */
  public static Optional<BigDecimal> amount(String text) {
    Matcher matcher = BRAZILIAN_AMOUNT.matcher(text.strip().replace("- ", "-").replace("− ", "−"));
    if (!matcher.matches()) {
      return Optional.empty();
    }
    BigDecimal value = new BigDecimal(matcher.group(2).replace(".", "") + "." + matcher.group(3));
    return Optional.of(matcher.group(1) == null ? value : value.negate());
  }

  public static String truncate(String description) {
    return description.length() <= MAX_DESCRIPTION_LENGTH
        ? description
        : description.substring(0, MAX_DESCRIPTION_LENGTH);
  }
}
