package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record MovementResponse(
    UUID id,
    MovementKind kind,
    @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
    BigDecimal amount,
    UUID fromAccountId,
    UUID toAccountId,
    UUID cardId,
    @JsonFormat(pattern = "yyyy/MM/dd") LocalDate billDueDate,
    UUID savingId,
    boolean opening,
    String notes,
    boolean automatic) {
  public static MovementResponse from(Movement movement) {
    return new MovementResponse(
        movement.getId(),
        movement.getKind(),
        movement.getDate(),
        movement.getAmount(),
        movement.getFromAccountId(),
        movement.getToAccountId(),
        movement.getCardId(),
        movement.getBillDueDate(),
        movement.getSavingId(),
        movement.isOpening(),
        movement.getNotes(),
        movement.isAutomatic());
  }
}
