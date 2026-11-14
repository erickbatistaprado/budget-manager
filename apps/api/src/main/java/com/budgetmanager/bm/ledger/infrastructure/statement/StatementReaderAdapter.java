package com.budgetmanager.bm.ledger.infrastructure.statement;

import com.budgetmanager.bm.ledger.application.StatementReader;
import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.stereotype.Component;

/** Detects the bank and format of an uploaded statement and reads it. */
@Component
public class StatementReaderAdapter implements StatementReader {

  private static final byte[] PDF_SIGNATURE = "%PDF".getBytes(StandardCharsets.US_ASCII);

  @Override
  public ParsedStatement read(byte[] content, String password) {
    if (content == null || content.length == 0) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "The file is empty");
    }
    if (isPdf(content)) {
      return readPdf(content, password);
    }
    String text = new String(content, StandardCharsets.UTF_8);
    if (NubankCardCsvParser.accepts(text)) {
      return NubankCardCsvParser.parse(text);
    }
    throw unsupported();
  }

  private static ParsedStatement readPdf(byte[] content, String password) {
    List<TextLine> lines = PdfTextExtractor.extract(content, password);
    if (lines.stream().allMatch(TextLine::isBlank)) {
      throw new ApplicationException(
          ApplicationError.UNPROCESSABLE,
          "This PDF has no text, probably a scan; export it again from the bank's app");
    }
    if (BradescoCardPdfParser.accepts(lines)) {
      return BradescoCardPdfParser.parse(lines);
    }
    if (NubankCardPdfParser.accepts(lines)) {
      return NubankCardPdfParser.parse(lines);
    }
    throw unsupported();
  }

  private static boolean isPdf(byte[] content) {
    if (content.length < PDF_SIGNATURE.length) {
      return false;
    }
    for (int index = 0; index < PDF_SIGNATURE.length; index++) {
      if (content[index] != PDF_SIGNATURE[index]) {
        return false;
      }
    }
    return true;
  }

  private static ApplicationException unsupported() {
    return new ApplicationException(
        ApplicationError.UNSUPPORTED_MEDIA_TYPE,
        "Unsupported statement. Supported: Bradesco card PDF, NuBank card PDF and NuBank card"
            + " CSV");
  }
}
