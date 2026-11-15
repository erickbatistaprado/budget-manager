package com.budgetmanager.bm.ledger.application;

import java.time.LocalDate;
import java.util.UUID;

/** An installment already moved to the day it was prepaid. */
public record PaidEarlyInstallment(UUID transactionId, int installmentNumber, LocalDate paidOn) {}
