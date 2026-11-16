package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AccountResponse(
    UUID id,
    String name,
    Bank bank,
    BigDecimal balance,
    @JsonFormat(pattern = "yyyy/MM/dd") LocalDate balanceCheckpointDate) {}
