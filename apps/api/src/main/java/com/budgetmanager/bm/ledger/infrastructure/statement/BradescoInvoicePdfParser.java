package com.budgetmanager.bm.ledger.infrastructure.statement;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementSource;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the monthly bill Bradesco sends as a PDF ("Fatura Mensal"), as opposed to the export of the
 * open bill from the Bradesco Cartões app ({@link BradescoCardPdfParser}).
 *
 * <p>Purchases sit in fixed columns (date, description, city, US$, R$) next to a sidebar of limits
 * and interest rates, so the bill is read in cells by horizontal position ({@link #COLUMNS}) and
 * the sidebar is dropped. Card headers straddle the columns, so they are read from the whole line
 * at the same height. Each card starts with {@code NAME Cartão 1234 XXXX XXXX 5678} and ends with
 * {@code Total para NAME}; credits end with {@code -}; long city names wrap onto a line of their
 * own; installments ({@code 09/11}) may be glued to the description. The due date gives the year.
 */
final class BradescoInvoicePdfParser {

  /** Column starts, in points: date, description, city, US$, R$, and where the sidebar begins. */
  static final float[] COLUMNS = {30f, 64f, 202f, 250f, 300f, 358f};

  private static final int DATE = 0;
  private static final int DESCRIPTION = 1;
  private static final int BRL = 4;

  private static final Pattern DUE_DATE =
      Pattern.compile("R\\$\\s*[\\d.]+,\\d{2}\\s+(\\d{2})/(\\d{2})/(\\d{4})");
  private static final Pattern ROW_DATE = Pattern.compile("^(\\d{2})/(\\d{2})$");
  private static final Pattern CARD =
      Pattern.compile("^(.+?)\\s+Cart[aã]o\\s+\\d{4}\\s+XXXX\\s+XXXX\\s+(\\d{4})\\b");
  private static final Pattern GLUED_INSTALLMENT = Pattern.compile("(?<=\\S)(\\d{2}/\\d{2})$");

  /**
   * The R$ amount ends its cell. The exchange rate of a purchase abroad ({@code 5,4400}) can spill
   * a digit into the cell ahead of it, so only the last number counts.
   */
  private static final Pattern AMOUNT = Pattern.compile("(?:^|\\s)([\\d.]+,\\d{2})\\s*(-)?$");

  /** Purchases abroad print the original amount after the merchant: {@code USD 5,06}. */
  private static final Pattern FOREIGN_AMOUNT = Pattern.compile("\\s+[A-Z]{3}\\s+[\\d.]+,\\d{2}$");

  private BradescoInvoicePdfParser() {}

  static boolean accepts(List<TextLine> lines) {
    return lines.stream().anyMatch(line -> line.trimmed().contains("Fatura Mensal"))
        && lines.stream()
            .anyMatch(
                line -> StatementText.normalize(line.text()).contains("total da fatura em real"));
  }

  static ParsedStatement parse(List<TextLine> lines, List<TextRow> rows) {
    LocalDate billDueDate = null;
    int dueMonth = 0;
    int dueYear = 0;
    for (TextLine line : lines) {
      Matcher due = DUE_DATE.matcher(line.trimmed());
      if (due.find()) {
        billDueDate =
            LocalDate.of(
                Integer.parseInt(due.group(3)),
                Integer.parseInt(due.group(2)),
                Integer.parseInt(due.group(1)));
        dueMonth = Integer.parseInt(due.group(2));
        dueYear = Integer.parseInt(due.group(3));
        break;
      }
    }
    if (dueMonth == 0) {
      throw new ApplicationException(
          ApplicationError.UNPROCESSABLE, "Could not find the due date of this Bradesco bill");
    }

    List<StatementLine> parsed = new ArrayList<>();
    BigDecimal parsedTotal = BigDecimal.ZERO;
    BigDecimal printedTotal = BigDecimal.ZERO;
    boolean cardTotalsFound = false;
    String cardholder = null;
    Map<Float, TextLine> linesByTop = new HashMap<>();
    for (TextLine line : lines) {
      linesByTop.put(line.top(), line);
    }
    for (TextRow row : rows) {
      String text = row.text();
      TextLine line = linesByTop.get(row.top());
      Matcher card = CARD.matcher(line == null ? text : line.trimmed());
      if (card.find()) {
        cardholder = card.group(1).strip() + " ••" + card.group(2);
        continue;
      }
      if (text.startsWith("Total para ")) {
        Optional<BigDecimal> cardTotal = amount(row.cell(BRL));
        if (cardTotal.isPresent()) {
          printedTotal = printedTotal.add(cardTotal.get());
          cardTotalsFound = true;
        }
        cardholder = null;
        continue;
      }
      Matcher date = ROW_DATE.matcher(row.cell(DATE));
      Optional<BigDecimal> amount = amount(row.cell(BRL));
      if (cardholder == null || !date.matches() || amount.isEmpty()) {
        continue;
      }
      String description =
          GLUED_INSTALLMENT
              .matcher(
                  FOREIGN_AMOUNT
                      .matcher(row.cell(DESCRIPTION).replaceAll("\\s+", " ").strip())
                      .replaceFirst(""))
              .replaceFirst(" $1");
      if (isPayment(description)) {
        continue;
      }
      parsedTotal = parsedTotal.add(amount.get());
      parsed.add(
          StatementLines.line(
              StatementLines.dateInStatementYear(
                  Integer.parseInt(date.group(1)),
                  Integer.parseInt(date.group(2)),
                  dueMonth,
                  dueYear),
              description,
              amount.get(),
              cardholder,
              StatementLines.InstallmentDate.PURCHASE));
    }
    return new ParsedStatement(
        StatementSource.BRADESCO_CARD_PDF,
        parsed,
        cardTotalsFound ? printedTotal : null,
        parsedTotal,
        billDueDate);
  }

  /** {@code 1.029,25} is a charge and {@code 147,60 -} a credit. */
  private static Optional<BigDecimal> amount(String cell) {
    Matcher matcher = AMOUNT.matcher(cell.strip());
    if (!matcher.find()) {
      return Optional.empty();
    }
    BigDecimal value = StatementText.amount(matcher.group(1)).orElseThrow();
    return Optional.of(matcher.group(2) == null ? value : value.negate());
  }

  private static boolean isPayment(String description) {
    String normalized = StatementText.normalize(description).toUpperCase(Locale.ROOT);
    return normalized.startsWith("PAGTO") || normalized.startsWith("PAGAMENTO");
  }
}
