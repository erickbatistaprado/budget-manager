package com.budgetmanager.bm.savings.infrastructure.http;

import com.budgetmanager.bm.savings.domain.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public record SavingDraft(
    UUID id,
    @NotBlank String name,
    @NotNull @DecimalMin("0") BigDecimal amount,
    @NotNull SavingLocation location,
    InvestmentType investmentType) {}
