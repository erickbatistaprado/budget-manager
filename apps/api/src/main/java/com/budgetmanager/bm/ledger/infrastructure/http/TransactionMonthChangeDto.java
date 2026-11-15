package com.budgetmanager.bm.ledger.infrastructure.http;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

/** The values one month of a monthly series takes instead of the series' own. */
public record TransactionMonthChangeDto(
    @NotNull @Positive BigDecimal amount,
    @NotNull @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
    String notes) {}
