package com.budgetmanager.bm.ledger.infrastructure.statement;

import java.util.List;

/**
 * One visual line of a PDF page split into fixed columns by horizontal position. {@code cells} has
 * one entry per column, empty when nothing is printed there; {@code top} grows downwards across
 * pages like {@link TextLine#top()}.
 */
public record TextRow(int page, float top, List<String> cells) {

  public TextRow {
    cells = List.copyOf(cells);
  }

  public String cell(int column) {
    return column < cells.size() ? cells.get(column) : "";
  }

  /** Every non-empty cell, joined with single spaces. */
  public String text() {
    return String.join(" ", cells.stream().filter(cell -> !cell.isEmpty()).toList());
  }
}
