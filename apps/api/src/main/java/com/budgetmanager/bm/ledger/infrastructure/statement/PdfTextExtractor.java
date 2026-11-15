package com.budgetmanager.bm.ledger.infrastructure.statement;

import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

/** Turns a PDF into visual lines, keeping the column gaps that statement layouts rely on. */
final class PdfTextExtractor {

  private static final float PAGE_OFFSET = 10_000f;
  private static final String COLUMN_GAP = "   ";

  private PdfTextExtractor() {}

  static List<TextLine> extract(byte[] pdf, String password) {
    List<TextLine> lines = new ArrayList<>();
    forEachPage(
        pdf,
        password,
        (page, positions) -> {
          for (List<TextPosition> row : groupRows(positions)) {
            lines.add(new TextLine(page, top(page, row), rowText(row)));
          }
        });
    return lines;
  }

  /**
   * Splits every line into columns by horizontal position: a character whose left edge is at or
   * after {@code boundaries[i]} and before {@code boundaries[i + 1]} belongs to column {@code i}.
   * Text left of the first boundary or from the last one on (a sidebar) is dropped.
   */
  static List<TextRow> extractColumns(byte[] pdf, String password, float... boundaries) {
    List<TextRow> rows = new ArrayList<>();
    forEachPage(
        pdf,
        password,
        (page, positions) -> {
          for (List<TextPosition> row : groupRows(positions)) {
            List<List<TextPosition>> columns = new ArrayList<>();
            for (int column = 0; column < boundaries.length - 1; column++) {
              columns.add(new ArrayList<>());
            }
            for (TextPosition position : row) {
              int column = columnOf(position.getXDirAdj(), boundaries);
              if (column >= 0) {
                columns.get(column).add(position);
              }
            }
            if (columns.stream().anyMatch(cell -> !rowText(cell).isBlank())) {
              rows.add(
                  new TextRow(
                      page,
                      top(page, row),
                      columns.stream().map(cell -> rowText(cell).strip()).toList()));
            }
          }
        });
    return rows;
  }

  private static int columnOf(float x, float[] boundaries) {
    for (int column = 0; column < boundaries.length - 1; column++) {
      if (x >= boundaries[column] && x < boundaries[column + 1]) {
        return column;
      }
    }
    return -1;
  }

  private interface PageConsumer {
    void accept(int page, List<TextPosition> positions);
  }

  private static void forEachPage(byte[] pdf, String password, PageConsumer consumer) {
    try (PDDocument document = load(pdf, password)) {
      for (int page = 1; page <= document.getNumberOfPages(); page++) {
        PositionCollector collector = new PositionCollector();
        collector.setStartPage(page);
        collector.setEndPage(page);
        collector.getText(document);
        consumer.accept(page, collector.positions);
      }
    } catch (InvalidPasswordException exception) {
      throw new ApplicationException(
          exception,
          ApplicationError.PASSWORD_REQUIRED,
          password == null || password.isEmpty()
              ? "This PDF is protected by a password"
              : "The password does not open this PDF");
    } catch (IOException exception) {
      throw new ApplicationException(
          exception, ApplicationError.UNSUPPORTED_MEDIA_TYPE, "This file is not a readable PDF");
    }
  }

  private static PDDocument load(byte[] pdf, String password) throws IOException {
    return password == null || password.isEmpty()
        ? Loader.loadPDF(pdf)
        : Loader.loadPDF(pdf, password);
  }

  /** Groups characters into visual lines, each sorted left to right. */
  private static List<List<TextPosition>> groupRows(List<TextPosition> positions) {
    List<TextPosition> sorted = new ArrayList<>(positions);
    sorted.sort(
        Comparator.comparingDouble(TextPosition::getYDirAdj)
            .thenComparingDouble(TextPosition::getXDirAdj));

    List<List<TextPosition>> rows = new ArrayList<>();
    List<TextPosition> current = new ArrayList<>();
    float rowY = Float.NaN;
    for (TextPosition position : sorted) {
      float tolerance = Math.max(position.getHeightDir(), 2f) * 0.6f;
      if (!current.isEmpty() && Math.abs(position.getYDirAdj() - rowY) > tolerance) {
        rows.add(current);
        current = new ArrayList<>();
      }
      if (current.isEmpty()) {
        rowY = position.getYDirAdj();
      }
      current.add(position);
    }
    if (!current.isEmpty()) {
      rows.add(current);
    }
    for (List<TextPosition> row : rows) {
      row.sort(Comparator.comparingDouble(TextPosition::getXDirAdj));
    }
    return rows;
  }

  private static float top(int page, List<TextPosition> row) {
    return page * PAGE_OFFSET + row.getFirst().getYDirAdj();
  }

  private static String rowText(List<TextPosition> row) {
    StringBuilder text = new StringBuilder();
    TextPosition previous = null;
    for (TextPosition position : row) {
      if (previous != null) {
        float gap = position.getXDirAdj() - (previous.getXDirAdj() + previous.getWidthDirAdj());
        float spaceWidth = Math.max(previous.getWidthOfSpace(), 1f);
        if (gap > spaceWidth * 2.5f) {
          text.append(COLUMN_GAP);
        } else if (gap > spaceWidth * 0.3f && !position.getUnicode().isBlank()) {
          text.append(' ');
        }
      }
      text.append(position.getUnicode());
      previous = position;
    }
    return text.toString().replaceAll("[ \\t]+$", "");
  }

  private static final class PositionCollector extends PDFTextStripper {

    private final List<TextPosition> positions = new ArrayList<>();

    PositionCollector() throws IOException {
      super();
      setSortByPosition(true);
    }

    @Override
    protected void processTextPosition(TextPosition text) {
      positions.add(text);
    }
  }
}
