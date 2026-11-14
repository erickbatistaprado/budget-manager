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
    try (PDDocument document = load(pdf, password)) {
      List<TextLine> lines = new ArrayList<>();
      for (int page = 1; page <= document.getNumberOfPages(); page++) {
        lines.addAll(extractPage(document, page));
      }
      return lines;
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

  private static List<TextLine> extractPage(PDDocument document, int page) throws IOException {
    PositionCollector collector = new PositionCollector();
    collector.setStartPage(page);
    collector.setEndPage(page);
    collector.getText(document);
    return toLines(collector.positions, page);
  }

  private static List<TextLine> toLines(List<TextPosition> positions, int page) {
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

    List<TextLine> lines = new ArrayList<>();
    for (List<TextPosition> row : rows) {
      row.sort(Comparator.comparingDouble(TextPosition::getXDirAdj));
      lines.add(new TextLine(page, page * PAGE_OFFSET + row.getFirst().getYDirAdj(), rowText(row)));
    }
    return lines;
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
