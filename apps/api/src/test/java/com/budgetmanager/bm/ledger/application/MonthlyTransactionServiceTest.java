package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.RepeatInterval;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MonthlyTransactionServiceTest {
  private final TransactionRepository repository = mock(TransactionRepository.class);
  private final UserService users = mock(UserService.class);
  private final CategoryService categories = mock(CategoryService.class);
  private final TransactionService service =
      new TransactionService(
          repository, users, categories, mock(CardService.class), mock(AccountService.class));
  private final Map<UUID, Transaction> transactions = new HashMap<>();
  private final Category category =
      Category.builder().id(UUID.randomUUID()).transactionType(TransactionType.EXPENSE).build();
  private Transaction original;

  @BeforeEach
  void setUp() {
    User owner = User.builder().id(UUID.randomUUID()).build();
    original =
        Transaction.builder()
            .id(UUID.randomUUID())
            .user(owner)
            .category(category)
            .date(LocalDate.of(2026, 1, 31))
            .totalValue(new BigDecimal("700"))
            .repeats(RepeatInterval.MONTHLY)
            .repeatUntil(LocalDate.of(2027, 6, 1))
            .build();
    transactions.put(original.getId(), original);
    when(users.requireCurrentUser()).thenReturn(owner);
    when(categories.requireOwned(category.getId(), owner)).thenReturn(category);
    when(repository.findByIdAndUserId(original.getId(), owner.getId()))
        .thenReturn(Optional.of(original));
    when(repository.saveAndFlush(any(Transaction.class)))
        .thenAnswer(invocation -> {
          Transaction saved = invocation.getArgument(0);
          if (saved.getId() == null) {
            saved.setId(UUID.randomUUID());
          }
          transactions.put(saved.getId(), saved);
          return saved;
        });
    when(repository.findAllWithCategoryAndInstallmentsByIdIn(anyList()))
        .thenAnswer(invocation -> {
          List<UUID> ids = invocation.getArgument(0);
          return ids.stream().map(transactions::get).toList();
        });
  }

  @Test
  void splitPreservesHistoryTypeAndOriginalEnd() {
    original.skipMonth(YearMonth.of(2026, 11));
    original.skipMonth(YearMonth.of(2026, 12));
    original.skipMonth(YearMonth.of(2027, 1));
    Transaction successor =
        service.split(original.getId(), YearMonth.of(2026, 12), draft(12), category.getId());
    assertThat(successor.getId()).isNotEqualTo(original.getId());
    assertThat(original.getRepeatUntil()).isEqualTo(LocalDate.of(2026, 11, 1));
    assertThat(original.getMonths()).hasSize(1);
    assertThat(original.getTotalValue()).isEqualByComparingTo("700");
    assertThat(successor.getRepeatUntil()).isEqualTo(LocalDate.of(2027, 6, 1));
    assertThat(successor.getTotalValue()).isEqualByComparingTo("800");
    assertThat(successor.getRepeats()).isEqualTo(RepeatInterval.MONTHLY);
    assertThat(successor.getMonths()).isEmpty();
  }

  @Test
  void firstMonthUpdatesInPlaceAndDropsOverrides() {
    original.skipMonth(YearMonth.of(2026, 12));
    Transaction updated =
        service.split(original.getId(), YearMonth.of(2026, 1), draft(1), category.getId());
    assertThat(updated).isSameAs(original);
    assertThat(updated.getDate()).isEqualTo(LocalDate.of(2026, 1, 5));
    assertThat(updated.getTotalValue()).isEqualByComparingTo("800");
    assertThat(updated.getMonths()).isEmpty();
    assertThat(updated.getRepeatUntil()).isEqualTo(LocalDate.of(2027, 6, 1));
  }

  @Test
  void firstMonthDeleteRemovesSeriesOtherwiseItCuts() {
    service.deleteFrom(original.getId(), YearMonth.of(2026, 12));
    verify(repository, never()).delete(original);
    assertThat(original.getRepeatUntil()).isEqualTo(LocalDate.of(2026, 11, 1));
    service.deleteFrom(original.getId(), YearMonth.of(2026, 1));
    verify(repository).delete(original);
  }

  @Test
  void rejectsNonMonthlyAndTypeChangesWithoutCutting() {
    category.setTransactionType(TransactionType.INCOME);
    original.setCategory(Category.builder().transactionType(TransactionType.EXPENSE).build());
    assertThatThrownBy(() ->
            service.split(original.getId(), YearMonth.of(2026, 12), draft(12), category.getId()))
        .isInstanceOf(ApplicationException.class);
    assertThat(original.getRepeatUntil()).isEqualTo(LocalDate.of(2027, 6, 1));
    original.setRepeats(RepeatInterval.NONE);
    assertThatThrownBy(() -> service.deleteFrom(original.getId(), YearMonth.of(2026, 12)))
        .isInstanceOf(ApplicationException.class);
  }

  private Transaction draft(int month) {
    return Transaction.builder()
        .date(LocalDate.of(2026, month, 5))
        .totalValue(new BigDecimal("800"))
        .notes("New fee")
        .build();
  }
}
