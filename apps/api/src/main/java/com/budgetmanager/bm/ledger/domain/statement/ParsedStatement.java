package com.budgetmanager.bm.ledger.domain.statement;

import java.math.BigDecimal;
import java.util.List;

/**
 * Lines read from one statement. {@code printedTotal} is the total the statement itself shows and
 * {@code parsedTotal} the sum of every row read, including skipped payments; when both are known
 * and differ, some row was misread or missed.
 */
public record ParsedStatement(
    StatementSource source,
    List<StatementLine> lines,
    BigDecimal printedTotal,
    BigDecimal parsedTotal) {

  public ParsedStatement {
    lines = List.copyOf(lines);
  }

  public boolean totalsMatch() {
    return printedTotal == null || parsedTotal == null || printedTotal.compareTo(parsedTotal) == 0;
  }
}
