package com.budgetmanager.bm.ledger.infrastructure.statement;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementSource;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/** Reads the CSV NuBank exports for a credit card bill: {@code date,title,amount}. */
final class NubankCardCsvParser {

  static final String HEADER = "date,title,amount";

  private NubankCardCsvParser() {}

  static boolean accepts(String content) {
    return firstLine(content).equalsIgnoreCase(HEADER);
  }

  static ParsedStatement parse(String content) {
    List<StatementLine> lines = new ArrayList<>();
    String[] rows = content.replace("\r", "").split("\n");
    for (int index = 1; index < rows.length; index++) {
      if (rows[index].isBlank()) {
        continue;
      }
      List<String> cells = cells(rows[index]);
      if (cells.size() != 3) {
        throw invalid(index + 1);
      }
      try {
        BigDecimal amount =
            StatementText.amount(cells.get(2)).orElseThrow(() -> invalid(rows.length));
        lines.add(
            StatementLines.line(
                LocalDate.parse(cells.get(0).strip()),
                cells.get(1),
                amount,
                null,
                StatementLines.InstallmentDate.BILLING));
      } catch (DateTimeParseException exception) {
        throw invalid(index + 1);
      }
    }
    return new ParsedStatement(StatementSource.NUBANK_CARD_CSV, lines, null, null);
  }

  /** Splits one CSV row, honouring quotes and doubled quotes inside them. */
  static List<String> cells(String row) {
    List<String> cells = new ArrayList<>();
    StringBuilder cell = new StringBuilder();
    boolean quoted = false;
    for (int index = 0; index < row.length(); index++) {
      char character = row.charAt(index);
      if (quoted) {
        if (character == '"' && index + 1 < row.length() && row.charAt(index + 1) == '"') {
          cell.append('"');
          index++;
        } else if (character == '"') {
          quoted = false;
        } else {
          cell.append(character);
        }
      } else if (character == '"') {
        quoted = true;
      } else if (character == ',') {
        cells.add(cell.toString());
        cell.setLength(0);
      } else {
        cell.append(character);
      }
    }
    cells.add(cell.toString());
    return cells;
  }

  private static String firstLine(String content) {
    String withoutBom = content.startsWith("﻿") ? content.substring(1) : content;
    int end = withoutBom.indexOf('\n');
    return (end < 0 ? withoutBom : withoutBom.substring(0, end)).strip();
  }

  private static ApplicationException invalid(int row) {
    return new ApplicationException(
        ApplicationError.UNPROCESSABLE, "Row {} of the NuBank CSV could not be read", row);
  }
}
