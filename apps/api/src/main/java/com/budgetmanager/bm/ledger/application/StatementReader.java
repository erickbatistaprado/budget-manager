package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;

/** Reads the lines of a bank statement file, whatever its bank and format. */
public interface StatementReader {

  /**
   * @param password only needed for protected PDFs; may be {@code null}
   */
  ParsedStatement read(byte[] content, String password);
}
