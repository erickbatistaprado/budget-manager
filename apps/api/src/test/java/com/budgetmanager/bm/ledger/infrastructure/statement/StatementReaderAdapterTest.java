package com.budgetmanager.bm.ledger.infrastructure.statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementSource;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;

class StatementReaderAdapterTest {

  private final StatementReaderAdapter reader = new StatementReaderAdapter();

  /** {x, y, text}: y counts from the top of the page, like the statements' layout. */
  private static final Object[][] BRADESCO_PAGE = {
    {40, 60, "Aplicativo Bradesco Cartoes"},
    {40, 80, "Data: 14/11/2026 - 18:49"},
    {40, 120, "ALEX SAMPLE - VISA INFINITE"},
    {400, 120, "XXXX.XXXX.XXXX.1111"},
    {80, 160, "LANGUAGE SCHOOL OF"},
    {40, 167, "05/02"},
    {300, 167, "BRL 60,00"},
    {520, 167, "60,00"},
    {80, 174, "10/11"},
    {40, 200, "05/11"},
    {80, 200, "AIRLINE TICKETS"},
    {300, 200, "BRL 45,00"},
    {520, 200, "45,00"},
    {40, 240, "."},
    {80, 240, "Total da Fatura em Real"},
    {520, 240, "R$ 105,00"},
  };

  @Test
  void readsAGeneratedBradescoPdfIncludingWrappedText() throws IOException {
    ParsedStatement statement = reader.read(pdf(BRADESCO_PAGE, null), null);

    assertThat(statement.source()).isEqualTo(StatementSource.BRADESCO_CARD_PDF);
    assertThat(statement.totalsMatch()).isTrue();
    assertThat(statement.lines())
        .extracting(StatementLine::description, StatementLine::installmentNumber)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("LANGUAGE SCHOOL OF", 10),
            org.assertj.core.groups.Tuple.tuple("AIRLINE TICKETS", null));
  }

  @Test
  void asksForThePasswordOfAProtectedPdf() throws IOException {
    byte[] protectedPdf = pdf(BRADESCO_PAGE, "12345");

    assertError(() -> reader.read(protectedPdf, null), ApplicationError.PASSWORD_REQUIRED);
    assertError(() -> reader.read(protectedPdf, "wrong"), ApplicationError.PASSWORD_REQUIRED);
    assertThat(reader.read(protectedPdf, "12345").lines()).hasSize(2);
  }

  @Test
  void readsANubankCsv() {
    byte[] csv =
        "date,title,amount\n2026-11-14,Corner Market,\"10,00\"\n".getBytes(StandardCharsets.UTF_8);

    assertThat(reader.read(csv, null).source()).isEqualTo(StatementSource.NUBANK_CARD_CSV);
  }

  @Test
  void rejectsUnknownFilesAndPdfs() throws IOException {
    assertError(
        () -> reader.read("hello,world\n".getBytes(StandardCharsets.UTF_8), null),
        ApplicationError.UNSUPPORTED_MEDIA_TYPE);
    assertError(
        () -> reader.read(pdf(new Object[][] {{40, 60, "Some other bank"}}, null), null),
        ApplicationError.UNSUPPORTED_MEDIA_TYPE);
    assertError(
        () -> reader.read("%PDF-1.7 broken".getBytes(StandardCharsets.US_ASCII), null),
        ApplicationError.UNSUPPORTED_MEDIA_TYPE);
    assertError(() -> reader.read(new byte[0], null), ApplicationError.BAD_REQUEST);
  }

  @Test
  void explainsThatAScannedPdfHasNoText() throws IOException {
    assertError(
        () -> reader.read(pdf(new Object[0][], null), null), ApplicationError.UNPROCESSABLE);
  }

  private static byte[] pdf(Object[][] texts, String password) throws IOException {
    try (PDDocument document = new PDDocument();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);
      float height = page.getMediaBox().getHeight();
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      try (PDPageContentStream content = new PDPageContentStream(document, page)) {
        for (Object[] text : texts) {
          content.beginText();
          content.setFont(font, 8);
          content.newLineAtOffset(
              ((Number) text[0]).floatValue(), height - ((Number) text[1]).floatValue());
          content.showText((String) text[2]);
          content.endText();
        }
      }
      if (password != null) {
        StandardProtectionPolicy policy =
            new StandardProtectionPolicy("owner-" + password, password, new AccessPermission());
        policy.setEncryptionKeyLength(128);
        document.protect(policy);
      }
      document.save(output);
      return output.toByteArray();
    }
  }

  private static void assertError(Runnable action, ApplicationError expected) {
    assertThatThrownBy(action::run)
        .isInstanceOfSatisfying(
            ApplicationException.class,
            exception -> assertThat(exception.getError()).isEqualTo(expected));
  }

  @FunctionalInterface
  private interface Runnable {
    void run() throws Exception;
  }
}
