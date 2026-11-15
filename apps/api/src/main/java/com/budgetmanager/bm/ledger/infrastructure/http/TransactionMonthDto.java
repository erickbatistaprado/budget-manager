package com.budgetmanager.bm.ledger.infrastructure.http;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.LocalDate;

/** One month of a monthly series that differs from the series: changed or skipped. */
public record TransactionMonthDto(
    String month,
    BigDecimal amount,
    @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
    String notes,
    boolean skipped) {}
