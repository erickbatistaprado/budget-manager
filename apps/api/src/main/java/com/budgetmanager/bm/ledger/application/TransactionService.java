package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.RepeatInterval;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TransactionService {

  private final TransactionRepository repository;
  private final UserService userService;
  private final CategoryService categoryService;

  @Transactional(readOnly = true)
  public Page<Transaction> findByTransactionTypeAndDateBetween(
      TransactionType transactionType,
      LocalDate startDate,
      LocalDate endDate,
      String sortKey,
      String sortOrder,
      Pageable pageable) {
    UUID userId = userService.requireCurrentUser().getId();
    Page<UUID> transactionIds =
        repository.findIdsByUserAndTypeAndDateBetween(
            userId,
            transactionType,
            startDate,
            endDate,
            startDate.withDayOfMonth(1),
            YearMonth.from(endDate).atEndOfMonth(),
            normalizeSortKey(sortKey),
            normalizeSortOrder(sortOrder),
            pageable);

    if (transactionIds.isEmpty()) {
      return Page.empty(pageable);
    }
    Map<UUID, Transaction> transactionsById =
        repository.findAllWithCategoryAndInstallmentsByIdIn(transactionIds.getContent()).stream()
            .collect(
                Collectors.toMap(Transaction::getId, Function.identity(), (left, right) -> left));
    List<Transaction> transactions =
        transactionIds.getContent().stream()
            .map(transactionsById::get)
            .filter(Objects::nonNull)
            .toList();

    transactions.forEach(
        transaction -> org.hibernate.Hibernate.initialize(transaction.getMonths()));
    return new PageImpl<>(transactions, pageable, transactionIds.getTotalElements());
  }

  @Transactional
  public Transaction save(Transaction draft, UUID categoryId) {
    User user = userService.requireCurrentUser();
    Transaction transaction =
        Transaction.builder()
            .user(user)
            .category(categoryService.requireOwned(categoryId, user))
            .build();
    apply(draft, transaction);
    return repository.save(transaction);
  }

  @Transactional
  public Transaction update(Transaction changes, UUID categoryId) {
    if (changes.getId() == null) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Transaction id is required");
    }
    User user = userService.requireCurrentUser();
    Transaction transaction = requireOwned(changes.getId(), user);
    rejectMonthlyWholeChange(transaction);
    transaction.setCategory(categoryService.requireOwned(categoryId, user));
    apply(changes, transaction);
    return loaded(transaction);
  }

  @Transactional
  public void deleteById(UUID id) {
    Transaction transaction = requireOwned(id, userService.requireCurrentUser());
    rejectMonthlyWholeChange(transaction);
    repository.delete(transaction);
  }

  /** Moves the chosen installments to the day they were prepaid. */
  @Transactional
  public Transaction payInstallmentsEarly(
      UUID transactionId, List<Integer> installmentNumbers, LocalDate paidOn) {
    return changeInstallments(
        transactionId,
        installmentNumbers,
        (transaction, number) -> transaction.payInstallmentEarly(number, paidOn));
  }

  /** Puts the chosen installments back in their original months. */
  @Transactional
  public Transaction restoreInstallments(UUID transactionId, List<Integer> installmentNumbers) {
    return changeInstallments(transactionId, installmentNumbers, Transaction::restoreInstallment);
  }

  private Transaction changeInstallments(
      UUID transactionId,
      List<Integer> installmentNumbers,
      java.util.function.ObjIntConsumer<Transaction> change) {
    if (installmentNumbers == null || installmentNumbers.isEmpty()) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Choose at least one installment");
    }
    Transaction transaction = requireOwned(transactionId, userService.requireCurrentUser());
    try {
      installmentNumbers.forEach(number -> change.accept(transaction, number));
    } catch (IllegalArgumentException exception) {
      throw new ApplicationException(
          exception, ApplicationError.BAD_REQUEST, exception.getMessage());
    }
    repository.saveAndFlush(transaction);
    // Reload with category and installments, so the caller can render it after the session ends.
    return loaded(transaction);
  }

  @Transactional
  public Transaction changeMonth(
      UUID id, YearMonth month, BigDecimal amount, LocalDate date, String notes) {
    Transaction transaction = requireOwned(id, userService.requireCurrentUser());
    monthlyChange(() -> transaction.changeMonth(month, amount, date, notes));
    return loaded(transaction);
  }

  @Transactional
  public void skipMonth(UUID id, YearMonth month, boolean restore) {
    Transaction transaction = requireOwned(id, userService.requireCurrentUser());
    monthlyChange(() -> {
      if (restore) {
        transaction.restoreMonth(month);
      } else {
        transaction.skipMonth(month);
      }
    });
    repository.save(transaction);
  }

  @Transactional
  public Transaction split(UUID id, YearMonth month, Transaction draft, UUID categoryId) {
    User user = userService.requireCurrentUser();
    Transaction original = requireOwned(id, user);
    monthlyChange(() -> original.requireMonth(month));
    var category = categoryService.requireOwned(categoryId, user);
    if (category.getTransactionType() != original.getCategory().getTransactionType()
        || draft.getDate() == null
        || !YearMonth.from(draft.getDate()).equals(month)) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST,
          "Keep the transaction type and choose a date in the selected month");
    }
    LocalDate until = original.getRepeatUntil();
    Transaction target = original;
    if (!month.equals(YearMonth.from(original.getDate()))) {
      original.endBefore(month);
      target = Transaction.builder().user(user).build();
    } else {
      original.dropMonthsFrom(month);
    }
    target.setCategory(category);
    draft.setRepeats(RepeatInterval.MONTHLY);
    draft.setInstallmentNumbers(null);
    apply(draft, target);
    target.setRepeatUntil(until);
    return loaded(target);
  }

  @Transactional
  public void deleteFrom(UUID id, YearMonth month) {
    Transaction transaction = requireOwned(id, userService.requireCurrentUser());
    monthlyChange(() -> transaction.requireMonth(month));
    if (month.equals(YearMonth.from(transaction.getDate()))) {
      repository.delete(transaction);
    } else {
      transaction.endBefore(month);
      repository.save(transaction);
    }
  }

  private Transaction loaded(Transaction transaction) {
    repository.saveAndFlush(transaction);
    Transaction result =
        repository
            .findAllWithCategoryAndInstallmentsByIdIn(List.of(transaction.getId()))
            .getFirst();
    org.hibernate.Hibernate.initialize(result.getMonths());
    return result;
  }

  private void monthlyChange(Runnable change) {
    try {
      change.run();
    } catch (IllegalArgumentException exception) {
      throw new ApplicationException(
          exception, ApplicationError.BAD_REQUEST, exception.getMessage());
    }
  }

  private void rejectMonthlyWholeChange(Transaction transaction) {
    if (transaction.getRepeats() == RepeatInterval.MONTHLY) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Choose a month and a scope for monthly changes");
    }
  }

  private void apply(Transaction source, Transaction target) {
    RepeatInterval repeats =
        source.getRepeats() == null ? RepeatInterval.NONE : source.getRepeats();
    if (source.getInstallmentNumbers() != null && repeats != RepeatInterval.NONE) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Transaction cannot repeat and have installments");
    }
    target.setNotes(source.getNotes());
    target.setTotalValue(source.getTotalValue());
    target.setDate(source.getDate());
    target.setRepeats(repeats);
    target.setInstallmentNumbers(source.getInstallmentNumbers());
    target.scheduleInstallments();
  }

  private Transaction requireOwned(UUID id, User user) {
    return repository
        .findByIdAndUserId(id, user.getId())
        .orElseThrow(() ->
            new ApplicationException(
                ApplicationError.NOT_FOUND, "Transaction not found for {}", id));
  }

  private String normalizeSortKey(String sortKey) {
    return switch (sortKey) {
      case "category", "notes", "date", "value" -> sortKey;
      case null, default -> "date";
    };
  }

  private String normalizeSortOrder(String sortOrder) {
    return "desc".equalsIgnoreCase(sortOrder) ? "desc" : "asc";
  }
}
