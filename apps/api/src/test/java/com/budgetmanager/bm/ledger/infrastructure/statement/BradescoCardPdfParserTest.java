package com.budgetmanager.bm.ledger.infrastructure.statement;

import static org.assertj.core.api.Assertions.assertThat;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class BradescoCardPdfParserTest {

  private static final List<TextLine> STATEMENT =
      lines(
          "1 76.7 Aplicativo Bradesco Cartões",
          "1 104.4 Data: 14/11/2026 - 18:49",
          "1 176.6 Situação do Extrato: EM ABERTO",
          "1 213.9 ALEX SAMPLE - VISA INFINITE   XXXX.XXXX.XXXX.1111",
          "1 247.6 Moeda de    Cotação",
          "1 254.3 Data   Histórico   US$   R$",
          "1 261.0 origem   US$",
          "1 294.7 05/11   SALDO ANTERIOR   BRL 0,00   0,00   R$ 0,00   500,00",
          "1 328.4 BRL",
          "1 335.1 05/11   PAGTO. POR DEB EM C/C   0,00   R$ 0,00   -500,00",
          "1 341.8 -500,00",
          "1 375.5 05/11   AIRLINE TICKETS   BRL 45,00   0,00   R$ 0,00   45,00",
          "1 409.2 27/08   PET CLINIC LTDA 3/5   BRL 100,00   0,00   R$ 0,00   100,00",
          "1 443.0 BRL",
          "1 449.7 24/07   CAR DEALER 4/4   0,00   R$ 0,00   1.000,00",
          "1 456.4 1.000,00",
          "1 490.1 LANGUAGE SCHOOL OF",
          "1 496.8 05/02   BRL 60,00   0,00   R$ 0,00   60,00",
          "1 503.5 10/11",
          "1 537.2 .   Total para ALEX SAMPLE   .   .   .   R$ 1.205,00",
          "1 571.9 SAM EXAMPLE - VISA INFINITE   XXXX.XXXX.XXXX.2222",
          "1 605.6 12/11   PET STORE   BRL 16,80   0,00   R$ 0,00   16,80",
          "2 51.2 12/11   FOOD DELIVERY   BRL 79,62   0,00   R$ 0,00   79,62",
          "2 84.8 CITY PARKING",
          "2 91.5 09/11   BRL 7,50   0,00   R$ 0,00   7,50",
          "2 98.2 LOT",
          "2 131.9 07/11   CAFE PR/SAO JOSE   BRL 17,90   0,00   R$ 0,00   17,90",
          "2 165.6 CINEMA CHAIN EC 2",
          "2 172.3 11/10   BRL 36,90   0,00   R$ 0,00   36,90",
          "2 179.0 /6",
          "2 212.7 14/11   REFUND STORE   BRL -12,00   0,00   R$ 0,00   -12,00",
          "2 246.4 Total para SAM",
          "2 253.1 .   .   .   .   R$ 128,82",
          "2 259.8 EXAMPLE",
          "2 293.5 .   Total da Fatura em Real   .   .   .   R$ 1.351,72");

  @Test
  void readsPurchasesAndSkipsBalanceAndPayments() {
    ParsedStatement statement = BradescoCardPdfParser.parse(STATEMENT);

    assertThat(statement.lines())
        .extracting(StatementLine::description)
        .containsExactly(
            "AIRLINE TICKETS",
            "PET CLINIC LTDA",
            "CAR DEALER",
            "LANGUAGE SCHOOL OF",
            "PET STORE",
            "FOOD DELIVERY",
            "CITY PARKING LOT",
            "CAFE PR/SAO JOSE",
            "CINEMA CHAIN EC",
            "REFUND STORE");
  }

  @Test
  void checksRowsAgainstThePrintedTotal() {
    ParsedStatement statement = BradescoCardPdfParser.parse(STATEMENT);

    assertThat(statement.printedTotal()).isEqualByComparingTo("1351.72");
    assertThat(statement.parsedTotal()).isEqualByComparingTo("1351.72");
    assertThat(statement.totalsMatch()).isTrue();
  }

  @Test
  void readsInstallmentsEvenWhenTheSuffixWraps() {
    List<StatementLine> installments =
        BradescoCardPdfParser.parse(STATEMENT).lines().stream()
            .filter(StatementLine::isInstallment)
            .toList();

    assertThat(installments)
        .extracting(
            StatementLine::description,
            StatementLine::installmentNumber,
            StatementLine::installmentTotal)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("PET CLINIC LTDA", 3, 5),
            org.assertj.core.groups.Tuple.tuple("CAR DEALER", 4, 4),
            org.assertj.core.groups.Tuple.tuple("LANGUAGE SCHOOL OF", 10, 11),
            org.assertj.core.groups.Tuple.tuple("CINEMA CHAIN EC", 2, 6));
  }

  @Test
  void usesThePurchaseDateAsTheFirstInstallmentAndInfersTheYear() {
    List<StatementLine> lines = BradescoCardPdfParser.parse(STATEMENT).lines();

    assertThat(byDescription(lines, "PET CLINIC LTDA").date()).isEqualTo(LocalDate.of(2026, 8, 27));
    assertThat(byDescription(lines, "LANGUAGE SCHOOL OF").date())
        .isEqualTo(LocalDate.of(2026, 2, 5));
    assertThat(byDescription(lines, "PET STORE").date()).isEqualTo(LocalDate.of(2026, 11, 12));
  }

  @Test
  void marksNegativeRowsAsCredits() {
    StatementLine refund =
        byDescription(BradescoCardPdfParser.parse(STATEMENT).lines(), "REFUND STORE");

    assertThat(refund.credit()).isTrue();
    assertThat(refund.amount()).isEqualByComparingTo(new BigDecimal("12.00"));
  }

  @Test
  void keepsTheCardholderOfEachSection() {
    List<StatementLine> lines = BradescoCardPdfParser.parse(STATEMENT).lines();

    assertThat(byDescription(lines, "AIRLINE TICKETS").cardholder())
        .isEqualTo("ALEX SAMPLE ••1111");
    assertThat(byDescription(lines, "FOOD DELIVERY").cardholder()).isEqualTo("SAM EXAMPLE ••2222");
  }

  @Test
  void reportsADifferenceWhenARowIsMissed() {
    List<TextLine> withoutOneRow =
        STATEMENT.stream().filter(line -> !line.text().contains("AIRLINE")).toList();

    assertThat(BradescoCardPdfParser.parse(withoutOneRow).totalsMatch()).isFalse();
  }

  private static StatementLine byDescription(List<StatementLine> lines, String description) {
    return lines.stream()
        .filter(line -> line.description().equals(description))
        .findFirst()
        .orElseThrow();
  }

  /** Each entry is {@code "page top text"}; columns are separated by three spaces. */
  static List<TextLine> lines(String... rows) {
    List<TextLine> lines = new ArrayList<>();
    for (String row : rows) {
      String[] parts = row.split(" ", 3);
      int page = Integer.parseInt(parts[0]);
      lines.add(new TextLine(page, page * 10_000f + Float.parseFloat(parts[1]), parts[2]));
    }
    return lines;
  }
}
