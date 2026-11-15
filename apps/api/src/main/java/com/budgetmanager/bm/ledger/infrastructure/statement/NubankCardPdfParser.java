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
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a NuBank credit card bill. Purchases are listed under "TRANSAÇÕES", grouped by cardholder
 * with a total per cardholder, and the "Pagamentos" section with bill payments is skipped.
 */
final class NubankCardPdfParser {

  private static final String AMOUNT = "([-−]?R\\$ [\\d.]+,\\d{2})";
  private static final Pattern CLOSING =
      Pattern.compile("FATURA\\s+\\d{1,2}\\s+([A-Z]{3})\\s+(\\d{4})");
  private static final Pattern TRANSACTION =
      Pattern.compile(
          "^(\\d{1,2}) ([A-Z]{3})\\s{3,}(?:•••• \\d{4}\\s{3,})?(.+?)\\s{3,}" + AMOUNT + "$");
  private static final Pattern CARDHOLDER_TOTAL =
      Pattern.compile("^([^\\d].*?)\\s{3,}" + AMOUNT + "$");

  private NubankCardPdfParser() {}

  static boolean accepts(List<TextLine> lines) {
    boolean bill = false;
    boolean transactions = false;
    for (TextLine line : lines) {
      bill |= CLOSING.matcher(line.trimmed()).find();
      transactions |= line.trimmed().startsWith("TRANSAÇÕES");
    }
    return bill && transactions;
  }

  static ParsedStatement parse(List<TextLine> lines) {
    LocalDate billDueDate = null;
    var duePattern =
        Pattern.compile("(?i)Data de vencimento:\\s*(\\d{1,2})\\s+([A-Z]{3})\\s+(\\d{4})");
    for (TextLine line : lines) {
      Matcher due = duePattern.matcher(line.trimmed());
      if (due.find()) {
        Integer month =
            StatementLines.PORTUGUESE_MONTHS.get(due.group(2).toUpperCase(java.util.Locale.ROOT));
        if (month != null) {
          billDueDate =
              LocalDate.of(Integer.parseInt(due.group(3)), month, Integer.parseInt(due.group(1)));
          break;
        }
      }
    }
    int closingMonth = 0;
    int closingYear = 0;
    for (TextLine line : lines) {
      Matcher matcher = CLOSING.matcher(line.trimmed());
      if (matcher.find() && StatementLines.PORTUGUESE_MONTHS.containsKey(matcher.group(1))) {
        closingMonth = StatementLines.PORTUGUESE_MONTHS.get(matcher.group(1));
        closingYear = Integer.parseInt(matcher.group(2));
        break;
      }
    }
    if (closingMonth == 0) {
      throw new ApplicationException(
          ApplicationError.UNPROCESSABLE, "Could not find the bill date in this NuBank statement");
    }

    List<StatementLine> parsed = new ArrayList<>();
    BigDecimal printedTotal = BigDecimal.ZERO;
    BigDecimal parsedTotal = BigDecimal.ZERO;
    boolean inTransactions = false;
    String cardholder = null;

    for (TextLine line : lines) {
      String text = line.trimmed();
      if (text.startsWith("TRANSAÇÕES")) {
        inTransactions = true;
        continue;
      }
      if (text.startsWith("Pagamentos") && text.contains("R$")) {
        inTransactions = false;
        continue;
      }
      if (!inTransactions || text.isEmpty()) {
        continue;
      }
      Matcher transaction = TRANSACTION.matcher(text);
      if (transaction.matches()
          && StatementLines.PORTUGUESE_MONTHS.containsKey(transaction.group(2))) {
        BigDecimal amount = StatementText.amount(transaction.group(4)).orElseThrow();
        parsedTotal = parsedTotal.add(amount);
        parsed.add(
            StatementLines.line(
                StatementLines.dateInStatementYear(
                    Integer.parseInt(transaction.group(1)),
                    StatementLines.PORTUGUESE_MONTHS.get(transaction.group(2)),
                    closingMonth,
                    closingYear),
                transaction.group(3),
                amount,
                cardholder,
                StatementLines.InstallmentDate.BILLING));
        continue;
      }
      Matcher holder = CARDHOLDER_TOTAL.matcher(text);
      if (holder.matches()) {
        cardholder = holder.group(1).strip();
        printedTotal = printedTotal.add(StatementText.amount(holder.group(2)).orElseThrow());
      }
    }
    return new ParsedStatement(
        StatementSource.NUBANK_CARD_PDF,
        parsed,
        printedTotal.signum() == 0 && parsed.isEmpty() ? null : printedTotal,
        parsedTotal,
        billDueDate);
  }
}
