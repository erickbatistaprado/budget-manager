package com.budgetmanager.bm.ledger.infrastructure.statement;

/**
 * One visual line of a PDF page. Wide horizontal gaps between words become runs of at least three
 * spaces, so parsers can split columns. {@code top} grows downwards across pages, so lines of later
 * pages always sort after earlier ones.
 */
public record TextLine(int page, float top, String text) {

  public String trimmed() {
    return text.strip();
  }

  public boolean isBlank() {
    return text.isBlank();
  }
}
