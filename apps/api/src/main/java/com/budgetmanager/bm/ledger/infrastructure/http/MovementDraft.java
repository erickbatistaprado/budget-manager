package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record MovementDraft(
    @NotNull MovementKind kind,
    @NotNull @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
    @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
    UUID fromAccountId,
    UUID toAccountId,
    UUID cardId,
    @JsonFormat(pattern = "yyyy/MM/dd") LocalDate billDueDate,
    UUID savingId,
    Boolean opening,
    @Size(max = 4000) String notes) {
  public Movement toDomain() {
    return Movement.builder()
        .kind(kind)
        .date(date)
        .amount(amount)
        .fromAccountId(fromAccountId)
        .toAccountId(toAccountId)
        .cardId(cardId)
        .billDueDate(billDueDate)
        .savingId(savingId)
        .opening(Boolean.TRUE.equals(opening))
        .notes(notes)
        .build();
  }
}
