package com.budgetmanager.bm.ledger.infrastructure.statement;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementSource;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a statement from the Bradesco Cartões app. Each row starts with {@code DD/MM}; long
 * descriptions wrap onto lines just above and below the row, and an installment suffix such as
 * {@code 3/5} may wrap too. The statement date in the header gives the year.
 */
final class BradescoCardPdfParser {

  private static final Pattern STATEMENT_DATE =
      Pattern.compile("Data:\\s*(\\d{2})/(\\d{2})/(\\d{4})");
  private static final Pattern ROW = Pattern.compile("^(\\d{2})/(\\d{2})(?:\\s{3,}(.*))?$");
  private static final Pattern COLUMNS = Pattern.compile("\\s{3,}");
  private static final Pattern CARD = Pattern.compile("^(.+?)\\s+-\\s+.*?(\\d{4})$");
  private static final Pattern INVOICE_TOTAL =
      Pattern.compile("Total da Fatura em Real.*?(-?R\\$ [\\d.]+,\\d{2})$");
  private static final Pattern AMOUNT_ONLY = Pattern.compile("^(BRL|-?[\\d.]+,\\d{2})$");

  /** Wrapped text sits about 7 points from its row; rows are about 34 points apart. */
  private static final float WRAP_DISTANCE = 15f;

  private static final List<String> NOT_DESCRIPTION =
      List.of(
          "Moeda de",
          "Data",
          "origem",
          "Histórico",
          "Cotação",
          "Total",
          "Situação",
          "Aplicativo",
          "*",
          ".",
          "XXXX");

  private BradescoCardPdfParser() {}

  static boolean accepts(List<TextLine> lines) {
    return lines.stream()
            .anyMatch(line -> StatementText.normalize(line.text()).contains("bradesco cartoes"))
        && lines.stream().anyMatch(line -> INVOICE_TOTAL.matcher(line.trimmed()).find());
  }

  static ParsedStatement parse(List<TextLine> allLines) {
    List<TextLine> lines = allLines.stream().filter(line -> !line.isBlank()).toList();
    int closingMonth = 0;
    int closingYear = 0;
    BigDecimal printedTotal = null;
    for (TextLine line : lines) {
      Matcher date = STATEMENT_DATE.matcher(line.trimmed());
      if (closingMonth == 0 && date.find()) {
        closingMonth = Integer.parseInt(date.group(2));
        closingYear = Integer.parseInt(date.group(3));
      }
      Matcher total = INVOICE_TOTAL.matcher(line.trimmed());
      if (total.find()) {
        printedTotal = StatementText.amount(total.group(1)).orElseThrow();
      }
    }
    if (closingMonth == 0) {
      throw new ApplicationException(
          ApplicationError.UNPROCESSABLE, "Could not find the date of this Bradesco statement");
    }

    Map<Integer, StringBuilder> prefixes = new HashMap<>();
    Map<Integer, StringBuilder> suffixes = new HashMap<>();
    attachWrappedText(lines, prefixes, suffixes);

    List<StatementLine> parsed = new ArrayList<>();
    BigDecimal parsedTotal = BigDecimal.ZERO;
    String cardholder = null;
    for (int index = 0; index < lines.size(); index++) {
      String text = lines.get(index).trimmed();
      Matcher card = CARD.matcher(text);
      if (text.contains("XXXX") && card.matches()) {
        cardholder = card.group(1).strip() + " ••" + card.group(2);
        continue;
      }
      Matcher row = ROW.matcher(text);
      if (!row.matches() || row.group(3) == null) {
        continue;
      }
      String[] cells = COLUMNS.split(row.group(3));
      BigDecimal amount = StatementText.amount(cells[cells.length - 1]).orElse(null);
      if (amount == null) {
        continue;
      }
      parsedTotal = parsedTotal.add(amount);

      String inline = cells.length > 1 && !isAmountColumn(cells[0]) ? cells[0] : "";
      String description =
          String.join(" ", textOf(prefixes.get(index)), inline, textOf(suffixes.get(index)))
              .strip()
              .replaceAll("\\s+", " ");
      if (isBalanceOrPayment(description)) {
        continue;
      }
      parsed.add(
          StatementLines.line(
              StatementLines.dateInStatementYear(
                  Integer.parseInt(row.group(1)),
                  Integer.parseInt(row.group(2)),
                  closingMonth,
                  closingYear),
              description,
              amount,
              cardholder,
              StatementLines.InstallmentDate.PURCHASE));
    }
    return new ParsedStatement(
        StatementSource.BRADESCO_CARD_PDF, parsed, printedTotal, parsedTotal);
  }

  /**
   * Each wrapped fragment belongs to the nearest line around it, as long as that line is a dated
   * row close enough to be its continuation.
   */
  private static void attachWrappedText(
      List<TextLine> lines,
      Map<Integer, StringBuilder> prefixes,
      Map<Integer, StringBuilder> suffixes) {
    for (int index = 0; index < lines.size(); index++) {
      TextLine line = lines.get(index);
      if (!isFragment(line)) {
        continue;
      }
      int above = index - 1;
      int below = index + 1;
      float distanceAbove =
          above >= 0 && lines.get(above).page() == line.page()
              ? line.top() - lines.get(above).top()
              : Float.MAX_VALUE;
      float distanceBelow =
          below < lines.size() && lines.get(below).page() == line.page()
              ? lines.get(below).top() - line.top()
              : Float.MAX_VALUE;
      if (distanceBelow <= distanceAbove
          && distanceBelow <= WRAP_DISTANCE
          && isRow(lines.get(below))) {
        append(prefixes, below, line.trimmed());
      } else if (distanceAbove < distanceBelow && distanceAbove <= WRAP_DISTANCE) {
        int row = above;
        while (row >= 0 && isFragment(lines.get(row))) {
          row--;
        }
        if (row >= 0 && isRow(lines.get(row))) {
          append(suffixes, row, line.trimmed());
        }
      }
    }
  }

  private static boolean isFragment(TextLine line) {
    String text = line.trimmed();
    if (text.isEmpty() || isRow(line) || AMOUNT_ONLY.matcher(text).matches()) {
      return false;
    }
    return NOT_DESCRIPTION.stream().noneMatch(text::startsWith) && !text.contains("XXXX");
  }

  /** A dated row has columns after the date; a bare {@code 10/11} is a wrapped installment. */
  private static boolean isRow(TextLine line) {
    Matcher row = ROW.matcher(line.trimmed());
    return row.matches() && row.group(3) != null;
  }

  private static boolean isAmountColumn(String cell) {
    return cell.startsWith("BRL") || StatementText.amount(cell).isPresent();
  }

  private static boolean isBalanceOrPayment(String description) {
    String normalized = StatementText.normalize(description).toUpperCase(Locale.ROOT);
    return Arrays.asList("SALDO ANTERIOR", "PAGTO", "PAGAMENTO").stream()
        .anyMatch(normalized::startsWith);
  }

  private static void append(Map<Integer, StringBuilder> fragments, int row, String text) {
    fragments.computeIfAbsent(row, key -> new StringBuilder()).append(' ').append(text);
  }

  private static String textOf(StringBuilder fragment) {
    return fragment == null ? "" : fragment.toString();
  }
}
