package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.Bank;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record CardDraft(
    @NotNull Bank bank,
    @NotBlank @Size(max = 255) String name,
    @NotNull @Min(1) @Max(31) Integer closingDay,
    @NotNull @Min(1) @Max(31) Integer dueDay,
    UUID paymentAccountId,
    UUID fundingAccountId) {}
