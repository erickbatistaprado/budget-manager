package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.Card;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record CardDto(
    UUID id,
    @NotBlank @Size(max = 255) String name,
    @NotNull @Min(1) @Max(31) Integer closingDay,
    @NotNull @Min(1) @Max(31) Integer dueDay) {
  public static CardDto from(Card card) {
    return new CardDto(card.getId(), card.getName(), card.getClosingDay(), card.getDueDay());
  }
}
