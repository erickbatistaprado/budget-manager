package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.Bank;
import com.budgetmanager.bm.ledger.domain.Card;
import com.budgetmanager.bm.ledger.domain.CardLimit;
import com.budgetmanager.bm.ledger.domain.PaymentMethod;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record CardDto(
    UUID id,
    @NotNull Bank bank,
    @NotBlank @Size(max = 255) String name,
    @NotNull @Min(1) @Max(31) Integer closingDay,
    @NotNull @Min(1) @Max(31) Integer dueDay,
    AccountDto paymentAccount,
    AccountDto fundingAccount,
    PaymentMethod billPaymentMethod,
    BigDecimal creditLimit,
    BigDecimal usedLimit,
    BigDecimal availableLimit) {
  public static CardDto from(Card card, CardLimit limit) {
    return new CardDto(
        card.getId(),
        card.getBank(),
        card.getName(),
        card.getClosingDay(),
        card.getDueDay(),
        card.getPaymentAccount() == null ? null : AccountDto.from(card.getPaymentAccount()),
        card.getFundingAccount() == null ? null : AccountDto.from(card.getFundingAccount()),
        card.getBillPaymentMethod(),
        limit.creditLimit(),
        limit.usedLimit(),
        limit.availableLimit());
  }
}
