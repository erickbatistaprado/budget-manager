package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.RepeatInterval;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.time.LocalDate;
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
    transaction.setCategory(categoryService.requireOwned(categoryId, user));
    apply(changes, transaction);
    return repository.save(transaction);
  }

  @Transactional
  public void deleteById(UUID id) {
    repository.delete(requireOwned(id, userService.requireCurrentUser()));
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
