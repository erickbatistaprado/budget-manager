package com.budgetmanager.bm.savings.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class SavingTest {

  @Test
  void investmentsNeedATypeAndOtherLocationsMustNotHaveOne() {
    Saving saving = new Saving();

    saving.place(SavingLocation.INVESTMENT, InvestmentType.CRYPTO);
    assertThat(saving.getInvestmentType()).isEqualTo(InvestmentType.CRYPTO);

    saving.place(SavingLocation.CASH, null);
    assertThat(saving.getLocation()).isEqualTo(SavingLocation.CASH);
    assertThat(saving.getInvestmentType()).isNull();

    assertThatThrownBy(() -> saving.place(SavingLocation.INVESTMENT, null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> saving.place(SavingLocation.CASH, InvestmentType.STOCKS))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> saving.place(null, null)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void everyTypeBelongsToAGroup() {
    assertThat(InvestmentType.TESOURO_DIRETO.group()).isEqualTo(InvestmentGroup.FIXED_INCOME);
    assertThat(InvestmentType.LCI_LCA.group()).isEqualTo(InvestmentGroup.FIXED_INCOME);
    assertThat(InvestmentType.REAL_ESTATE_FUNDS.group()).isEqualTo(InvestmentGroup.VARIABLE_INCOME);
    assertThat(InvestmentType.CRYPTO.group()).isEqualTo(InvestmentGroup.VARIABLE_INCOME);
    assertThat(InvestmentType.PRIVATE_PENSION.group()).isEqualTo(InvestmentGroup.FUNDS_AND_PENSION);
    assertThat(Arrays.stream(InvestmentType.values()))
        .allSatisfy(type -> assertThat(type.group()).isNotNull());
  }
}
