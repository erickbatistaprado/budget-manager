package com.budgetmanager.bm.ledger.domain.statement;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class MerchantTextTest {

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "SJP BARAO 35 | sjp barao",
        "Sjp Barao | sjp barao",
        "CORNER MARKET LJ33 | corner market",
        "Corner Market Lj33 | corner market",
        "ACME COMERCIO LTDA | acme comercio",
        "Mercadolivre*Seller | mercadolivre seller",
        "Electro - NuPay | electro",
        "Padaria São João | padaria sao joao",
        "12345678 | ''"
      })
  void buildsTheSameKeyForTheSameMerchant(String description, String key) {
    assertThat(MerchantText.merchantKey(description)).isEqualTo(key);
  }
}
