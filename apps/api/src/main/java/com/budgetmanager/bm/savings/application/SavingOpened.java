package com.budgetmanager.bm.savings.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SavingOpened(UUID id, UUID userId, BigDecimal amount, LocalDate date) {}
