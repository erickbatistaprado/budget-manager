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

  /**
   * The monthly bill: fixed columns at the positions of the real layout (date 45, description 67,
   * city 204, R$ ending before 358) next to a sidebar from x 364 that shares their lines.
   */
  private static final Object[][] BRADESCO_INVOICE_PAGE = {
    {67, 30, "Fatura Mensal"},
    {420, 50, "Total da fatura"},
    {420, 60, "R$ 1.133,56"},
    {500, 60, "05/11/2026"},
    {45, 100, "Data"},
    {67, 100, "Historico de Lancamentos"},
    {204, 100, "Cidade"},
    {332, 100, "R$"},
    {45, 115, "05/10"},
    {67, 115, "PAGTO. POR DEB EM C/C"},
    {315, 115, "900,00 -"},
    {45, 130, "ALEX SAMPLE"},
    {150, 130, "Cartão 4066 XXXX XXXX 1111"},
    {364, 130, "Saque Parcelado 9,99% 213,50%"},
    {45, 145, "27/12"},
    {67, 145, "PET CLINIC"},
    {150, 145, "10/10"},
    {204, 145, "CURITIBA"},
    {320, 145, "469,43"},
    {364, 145, "Compras R$ 42.600,00 R$ 16.585,44"},
    {45, 160, "05/02"},
    {67, 160, "LANGUAGE SCHOOL I09/11"},
    {204, 160, "SAO JOSE DOS"},
    {320, 160, "692,67"},
    {204, 168, "PINHAIS"},
    {45, 183, "Total para ALEX SAMPLE"},
    {315, 183, "1.162,10"},
    {45, 198, "SAM EXAMPLE"},
    {150, 198, "Cartão 4066 XXXX XXXX 2222"},
    {45, 206, "06/07"},
    {67, 206, "BAKERY LISBOA"},
    {150, 206, "USD"},
    {170, 206, "11,85"},
    {204, 206, "LISBOA"},
    {253, 206, "11,85"},
    {290, 206, "5,4400"},
    {325, 206, "64,46"},
    {45, 213, "11/10"},
    {67, 213, "CINEMA CHAIN EC"},
    {204, 213, "SAO PAULO"},
    {315, 213, "147,60 -"},
    {45, 228, "21/10"},
    {67, 228, "FUEL STATION"},
    {204, 228, "OSASCO"},
    {320, 228, "54,60"},
    {364, 228, "Rotativo 14,99% 434,46%"},
    {45, 243, "Total para SAM EXAMPLE"},
    {320, 243, "28,54 -"},
    {45, 258, "Total da fatura em real"},
    {315, 258, "1.133,56"},
  };

  @Test
  void readsTheMonthlyBradescoBillByColumns() throws IOException {
    ParsedStatement statement = reader.read(pdf(BRADESCO_INVOICE_PAGE, null), null);

    assertThat(statement.source()).isEqualTo(StatementSource.BRADESCO_CARD_PDF);
    assertThat(statement.billDueDate()).isEqualTo(java.time.LocalDate.of(2026, 11, 5));
    assertThat(statement.printedTotal()).isEqualByComparingTo("1133.56");
    assertThat(statement.totalsMatch()).isTrue();
    assertThat(statement.lines())
        .extracting(
            StatementLine::date,
            StatementLine::description,
            StatementLine::amount,
            StatementLine::credit,
            StatementLine::installmentNumber,
            StatementLine::cardholder)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple(
                java.time.LocalDate.of(2025, 12, 27),
                "PET CLINIC",
                new java.math.BigDecimal("469.43"),
                false,
                10,
                "ALEX SAMPLE ••1111"),
            org.assertj.core.groups.Tuple.tuple(
                java.time.LocalDate.of(2026, 2, 5),
                "LANGUAGE SCHOOL I",
                new java.math.BigDecimal("692.67"),
                false,
                9,
                "ALEX SAMPLE ••1111"),
            org.assertj.core.groups.Tuple.tuple(
                java.time.LocalDate.of(2026, 7, 6),
                "BAKERY LISBOA",
                new java.math.BigDecimal("64.46"),
                false,
                null,
                "SAM EXAMPLE ••2222"),
            org.assertj.core.groups.Tuple.tuple(
                java.time.LocalDate.of(2026, 10, 11),
                "CINEMA CHAIN EC",
                new java.math.BigDecimal("147.60"),
                true,
                null,
                "SAM EXAMPLE ••2222"),
            org.assertj.core.groups.Tuple.tuple(
                java.time.LocalDate.of(2026, 10, 21),
                "FUEL STATION",
                new java.math.BigDecimal("54.60"),
                false,
                null,
                "SAM EXAMPLE ••2222"));
  }

  @Test
  void readsAGeneratedBradescoPdfIncludingWrappedText() throws IOException {
    ParsedStatement statement = reader.read(pdf(BRADESCO_PAGE, null), null);

    assertThat(statement.source()).isEqualTo(StatementSource.BRADESCO_CARD_PDF);
    assertThat(statement.totalsMatch()).isTrue();
    assertThat(statement.billDueDate()).isNull();
    assertThat(statement.statementDate()).isEqualTo(java.time.LocalDate.of(2026, 11, 14));
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
