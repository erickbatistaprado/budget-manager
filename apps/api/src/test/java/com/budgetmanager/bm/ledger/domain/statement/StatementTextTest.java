package com.budgetmanager.bm.ledger.domain.statement;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class StatementTextTest {

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "Bike Shop - Parcela 6/8 | Bike Shop | 6 | 8",
        "Antecipada - Bike Shop - Parcela 8/8 | Bike Shop | 8 | 8",
        "GYM STORE LTDA 3/5 | GYM STORE LTDA | 3 | 5",
        "LANGUAGE SCHOOL 10/11 | LANGUAGE SCHOOL | 10 | 11",
        "CINEMA CHAIN EC 2 /6 | CINEMA CHAIN EC | 2 | 6"
      })
  void findsInstallments(String description, String purchase, int number, int total) {
    assertThat(StatementText.installment(description))
        .contains(new StatementText.Installment(purchase, number, total));
  }

  @ParameterizedTest
  @ValueSource(strings = {"CAFE PR/SAO JOSE", "STORE 35", "PARKING 9/3", "SHOP 0/4", "PLAN 1/1"})
  void ignoresTextThatIsNotAnInstallment(String description) {
    assertThat(StatementText.installment(description)).isEmpty();
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "1.612,50 | 1612.50",
        "R$ 7,95 | 7.95",
        "−R$ 40,26 | -40.26",
        "-R$ 17.811,74 | -17811.74",
        "- 93,69 | -93.69",
        "-7.958,43 | -7958.43",
        "0,05 | 0.05"
      })
  void readsBrazilianAmounts(String text, BigDecimal expected) {
    assertThat(StatementText.amount(text))
        .hasValueSatisfying(amount -> assertThat(amount).isEqualByComparingTo(expected));
  }

  @ParameterizedTest
  @ValueSource(strings = {"BRL", "4/4", "35", "12.50", "R$"})
  void rejectsWhatIsNotAnAmount(String text) {
    assertThat(StatementText.amount(text)).isEmpty();
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "  Padaria   São João | padaria sao joao",
        "Crédito de \"Serviço\" | credito de \"servico\"",
        "MERCADO  CENTRAL | mercado central"
      })
  void normalizesForComparison(String description, String expected) {
    assertThat(StatementText.normalize(description)).isEqualTo(expected);
  }
}
