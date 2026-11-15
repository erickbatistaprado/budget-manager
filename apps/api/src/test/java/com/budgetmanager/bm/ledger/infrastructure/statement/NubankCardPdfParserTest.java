package com.budgetmanager.bm.ledger.infrastructure.statement;

import static com.budgetmanager.bm.ledger.infrastructure.statement.BradescoCardPdfParserTest.lines;
import static org.assertj.core.api.Assertions.assertThat;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class NubankCardPdfParserTest {

  private static final List<TextLine> BILL =
      lines(
          "1 100 Olá, Alex.",
          "1 120 Data de vencimento: 09 NOV 2026",
          "2 60 FATURA 09 JAN 2027   EMISSÃO E ENVIO 31 DEZ 2026",
          "2 150 Pagamento recebido   −R$ 900,00",
          "3 60 FATURA 09 JAN 2027   EMISSÃO E ENVIO 31 DEZ 2026",
          "3 110 TRANSAÇÕES   DE 30 NOV A 31 DEZ",
          "3 176 Alex Sample   R$ 1.750,12",
          "3 224 30 NOV   •••• 1234   Bike Shop - Parcela 6/8   R$ 800,00",
          "3 246 02 DEZ   •••• 1234   Antecipada - Bike Shop - Parcela 7/8   R$ 800,00",
          "3 268 02 DEZ   Desconto Antecipação Bike Shop   −R$ 20,00",
          "3 290 05 DEZ   •••• 1234   Game Store   R$ 23,09",
          "3 300 BRL 22.27 = USD 4.27",
          "3 309 Conversão: BRL 5.40 = USD 1 = R$ 5,40",
          "3 326 05 DEZ   IOF de \"Game Store\"   R$ 0,81",
          "4 60 FATURA 09 JAN 2027   EMISSÃO E ENVIO 31 DEZ 2026",
          "4 110 TRANSAÇÕES   DE 30 NOV A 31 DEZ",
          "4 150 14 DEZ   Estorno de \"Game Store\"   −R$ 23,09",
          "4 166 Estorno referente a compra em Game Store, de valor R$",
          "4 200 03 JAN   Phone Plan   R$ 169,31",
          "4 300 Pagamentos   -R$ 900,00",
          "4 322 30 NOV   Pagamento em 30 NOV   −R$ 900,00");

  @Test
  void readsThePrintedDueDate() {
    assertThat(NubankCardPdfParser.parse(BILL).billDueDate()).isEqualTo(LocalDate.of(2026, 11, 9));
  }

  @Test
  void readsTransactionsAndSkipsPayments() {
    ParsedStatement statement = NubankCardPdfParser.parse(BILL);

    assertThat(statement.lines())
        .extracting(StatementLine::description)
        .containsExactly(
            "Bike Shop",
            "Bike Shop",
            "Desconto Antecipação Bike Shop",
            "Game Store",
            "IOF de \"Game Store\"",
            "Estorno de \"Game Store\"",
            "Phone Plan");
  }

  @Test
  void checksTransactionsAgainstTheCardholderTotal() {
    ParsedStatement statement = NubankCardPdfParser.parse(BILL);

    assertThat(statement.printedTotal()).isEqualByComparingTo("1750.12");
    assertThat(statement.parsedTotal()).isEqualByComparingTo("1750.12");
    assertThat(statement.totalsMatch()).isTrue();
  }

  @Test
  void datesInstallmentsFromTheBillThatShowsThem() {
    StatementLine sixth = NubankCardPdfParser.parse(BILL).lines().getFirst();

    assertThat(sixth.installmentNumber()).isEqualTo(6);
    assertThat(sixth.installmentTotal()).isEqualTo(8);
    assertThat(sixth.date()).isEqualTo(LocalDate.of(2026, 6, 30));
    assertThat(sixth.totalValue()).isEqualByComparingTo("6400.00");
  }

  @Test
  void keepsThePaymentDateOfPrepaidInstallments() {
    StatementLine prepaid = NubankCardPdfParser.parse(BILL).lines().get(1);

    assertThat(prepaid.paidEarly()).isTrue();
    assertThat(prepaid.installmentNumber()).isEqualTo(7);
    assertThat(prepaid.date()).isEqualTo(LocalDate.of(2026, 12, 2));
    assertThat(NubankCardPdfParser.parse(BILL).lines().getFirst().paidEarly()).isFalse();
  }

  @Test
  void placesDecemberInThePreviousYearOfAJanuaryBill() {
    List<StatementLine> lines = NubankCardPdfParser.parse(BILL).lines();

    assertThat(lines.get(3).date()).isEqualTo(LocalDate.of(2026, 12, 5));
    assertThat(lines.getLast().date()).isEqualTo(LocalDate.of(2027, 1, 3));
  }

  @Test
  void marksRefundsAndDiscountsAsCredits() {
    assertThat(NubankCardPdfParser.parse(BILL).lines())
        .filteredOn(StatementLine::credit)
        .extracting(StatementLine::description)
        .containsExactly("Desconto Antecipação Bike Shop", "Estorno de \"Game Store\"");
  }

  @Test
  void keepsTheCardholder() {
    assertThat(NubankCardPdfParser.parse(BILL).lines())
        .extracting(StatementLine::cardholder)
        .containsOnly("Alex Sample");
  }
}
