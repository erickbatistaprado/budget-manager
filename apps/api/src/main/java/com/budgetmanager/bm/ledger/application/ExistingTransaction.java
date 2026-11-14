package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.ledger.domain.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** The parts of a saved transaction that statement imports compare against. */
public record ExistingTransaction(
    UUID id,
    String notes,
    LocalDate date,
    BigDecimal totalValue,
    Integer installmentNumbers,
    UUID categoryId,
    TransactionType transactionType) {}
