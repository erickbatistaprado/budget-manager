package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application boundary for financing-owned expenses; never uses purchase regeneration. */
@Service
@RequiredArgsConstructor
public class FinancingLedgerService {
  private final TransactionRepository repository;
  private final UserService users;
  private final CategoryService categories;
  private final AccountService accounts;

  public record Payment(int number, LocalDate dueDate, BigDecimal amount) {}

  @Transactional
  public void synchronize(
      UUID financingId,
      String name,
      UUID categoryId,
      PaymentMethod method,
      UUID accountId,
      int term,
      LocalDate firstDate,
      List<Payment> payments) {
    Transaction transaction =
        repository.findByFinancingId(financingId).stream()
            .filter(saved -> saved.getInstallmentNumbers() != null)
            .findFirst()
            .orElseGet(() ->
                Transaction.builder()
                    .user(users.requireCurrentUser())
                    .source("FINANCING")
                    .financingId(financingId)
                    .build());
    configure(transaction, name, categoryId, method, accountId);
    transaction.setDate(firstDate);
    transaction.setInstallmentNumbers(term);
    transaction.setTotalValue(
        payments.stream().map(Payment::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
    transaction.getInstallments().clear();
    for (Payment payment : payments) {
      transaction
          .getInstallments()
          .add(
              Installment.builder()
                  .transaction(transaction)
                  .installmentNumber(payment.number())
                  .totalInstallments(term)
                  .amount(payment.amount())
                  .dueDate(payment.dueDate())
                  .build());
    }
    repository.save(transaction);
  }

  private void configure(
      Transaction transaction, String name, UUID categoryId, PaymentMethod method, UUID accountId) {
    transaction.setCategory(categories.requireOwned(categoryId, transaction.getUser()));
    if (transaction.getCategory().getTransactionType() != TransactionType.EXPENSE) {
      throw new IllegalArgumentException("Financing requires an expense category");
    }
    transaction.setPaymentMethod(method);
    transaction.setAccount(
        accountId == null ? null : accounts.requireOwned(accountId, transaction.getUser()));
    transaction.setRepeats(RepeatInterval.NONE);
    transaction.setNotes(name);
    transaction.validatePayment();
  }

  @Transactional
  public void extra(
      UUID financingId,
      String name,
      UUID categoryId,
      PaymentMethod method,
      UUID accountId,
      LocalDate date,
      BigDecimal amount) {
    Transaction transaction =
        Transaction.builder()
            .user(users.requireCurrentUser())
            .source("FINANCING")
            .financingId(financingId)
            .date(date)
            .totalValue(amount)
            .build();
    configure(transaction, name, categoryId, method, accountId);
    repository.save(transaction);
  }

  @Transactional
  public void delete(UUID financingId) {
    repository.deleteAll(repository.findByFinancingId(financingId));
  }
}
