package com.budgetmanager.bm.ledger.infrastructure.statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class NubankCardCsvParserTest {
  @Test
  void readsDueDateFromTheOriginalFilenameOnly() {
    var reader = new StatementReaderAdapter();
    byte[] csv =
        "date,title,amount\n2026-11-12,Shop,\"12,00\""
            .getBytes(java.nio.charset.StandardCharsets.UTF_8);
    assertThat(reader.read(csv, null, "Nubank_2026-12-07.csv").billDueDate())
        .isEqualTo(LocalDate.of(2026, 12, 7));
    assertThat(reader.read(csv, null, "other.csv").billDueDate()).isNull();
    assertThat(reader.read(csv, null, "Nubank_2026-02-30.csv").billDueDate()).isNull();
  }

  private static final String CSV =
      """
      date,title,amount
      2026-11-14,Corner Market,"266,61"
      2026-11-14,"Crédito de ""Cloud Storage"" (Cloud Storage)","- 93,69"
      2026-11-13,Bike Shop - Parcela 2/3,"150,00"
      2026-11-12,"Bakery, Downtown","1.050,00"
      """;

  @Test
  void readsRowsWithQuotesCommasAndCredits() {
    ParsedStatement statement = NubankCardCsvParser.parse(CSV);

    assertThat(statement.lines())
        .extracting(StatementLine::description)
        .containsExactly(
            "Corner Market",
            "Crédito de \"Cloud Storage\" (Cloud Storage)",
            "Bike Shop",
            "Bakery, Downtown");
    assertThat(statement.lines().get(1).credit()).isTrue();
    assertThat(statement.lines().get(1).amount()).isEqualByComparingTo("93.69");
    assertThat(statement.lines().get(3).amount()).isEqualByComparingTo("1050.00");
  }

  @Test
  void datesInstallmentsFromTheBillingDate() {
    StatementLine installment = NubankCardCsvParser.parse(CSV).lines().get(2);

    assertThat(installment.installmentNumber()).isEqualTo(2);
    assertThat(installment.date()).isEqualTo(LocalDate.of(2026, 10, 13));
  }

  @Test
  void recognizesTheHeaderWithAByteOrderMark() {
    assertThat(NubankCardCsvParser.accepts("﻿date,title,amount\n")).isTrue();
    assertThat(NubankCardCsvParser.accepts("Data,Valor,Identificador,Descrição\n")).isFalse();
  }

  @Test
  void rejectsUnreadableRows() {
    assertThatThrownBy(
            () -> NubankCardCsvParser.parse("date,title,amount\nyesterday,Shop,\"1,00\""))
        .isInstanceOf(ApplicationException.class)
        .hasMessageContaining("Row 2");
  }
}
