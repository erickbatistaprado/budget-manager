package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.Installment;
import com.budgetmanager.bm.ledger.domain.RepeatInterval;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.budgetmanager.bm.support.IntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;

class LedgerIntegrationTest extends IntegrationTest {

  @Autowired private CategoryService categoryService;
  @Autowired private TransactionService transactionService;
  @Autowired private TransactionRepository transactionRepository;

  private User alice;
  private User bob;

  @BeforeEach
  void setUp() {
    alice = registerUser();
    bob = registerUser();
  }

  @Test
  void newUsersStartWithTheDefaultCategories() {
    signIn(alice);

    assertThat(categoryService.findByTransactionType(TransactionType.EXPENSE))
        .extracting(Category::getName)
        .contains("Groceries", "Restaurants", "Subscriptions", "Other")
        .hasSize(18);
    assertThat(categoryService.findByTransactionType(TransactionType.INCOME))
        .extracting(Category::getName)
        .containsExactlyInAnyOrder("Salary", "Freelance", "Investments", "Refunds", "Other");
  }

  @Test
  void categoriesAreVisibleOnlyToTheirOwner() {
    signIn(alice);
    Category food = categoryService.save(category("Food", TransactionType.EXPENSE));

    signIn(bob);
    assertThat(categoryService.findByTransactionType(TransactionType.EXPENSE))
        .extracting(Category::getId)
        .doesNotContain(food.getId());
  }

  @Test
  void differentUsersCanUseTheSameCategoryName() {
    signIn(alice);
    categoryService.save(category("Rent", TransactionType.EXPENSE));

    signIn(bob);
    Category bobRent = categoryService.save(category("Rent", TransactionType.EXPENSE));

    assertThat(bobRent.getId()).isNotNull();
  }

  @Test
  void duplicateCategoryNamesAreRejectedIgnoringCase() {
    signIn(alice);
    categoryService.save(category("Bakery", TransactionType.EXPENSE));

    assertError(
        () -> categoryService.save(category("  bakery ", TransactionType.EXPENSE)),
        ApplicationError.CONFLICT);
    assertError(
        () ->
            categoryService.saveAll(
                List.of(
                    category("Gym", TransactionType.EXPENSE),
                    category("GYM", TransactionType.EXPENSE))),
        ApplicationError.CONFLICT);
  }

  @Test
  void sameNameIsAllowedForIncomeAndExpense() {
    signIn(alice);
    categoryService.save(category("Consulting", TransactionType.EXPENSE));

    Category income = categoryService.save(category("Consulting", TransactionType.INCOME));

    assertThat(income.getId()).isNotNull();
  }

  @Test
  void transactionsCannotUseAnotherUsersCategory() {
    signIn(alice);
    Category aliceCategory = categoryService.save(category("Trips", TransactionType.EXPENSE));

    signIn(bob);
    assertError(
        () -> transactionService.save(draft("50.00", null), aliceCategory.getId()),
        ApplicationError.NOT_FOUND);
  }

  @Test
  void installmentsAddUpToTheTotalWhenSaved() {
    signIn(alice);
    Category category = categoryService.save(category("Laptop", TransactionType.EXPENSE));

    Transaction saved = transactionService.save(draft("100.00", 3), category.getId());

    assertThat(reload(saved.getId()).getInstallments())
        .extracting(Installment::getAmount)
        .containsExactlyInAnyOrder(
            new BigDecimal("33.33"), new BigDecimal("33.33"), new BigDecimal("33.34"));
  }

  @Test
  void updatingTotalAndCountRebuildsInstallments() {
    signIn(alice);
    Category category = categoryService.save(category("Phone", TransactionType.EXPENSE));
    Transaction saved = transactionService.save(draft("90.00", 3), category.getId());

    Transaction changes = draft("120.00", 4);
    changes.setId(saved.getId());
    transactionService.update(changes, category.getId());

    Transaction reloaded = reload(saved.getId());
    assertThat(reloaded.getInstallments()).hasSize(4);
    assertThat(reloaded.getInstallments())
        .allSatisfy(
            installment -> assertThat(installment.getAmount()).isEqualByComparingTo("30.00"));
  }

  @Test
  void updatingOnlyTheNotesKeepsTheInstallments() {
    signIn(alice);
    Category category = categoryService.save(category("Sofa", TransactionType.EXPENSE));
    Transaction saved = transactionService.save(draft("300.00", 3), category.getId());
    List<UUID> idsBefore =
        reload(saved.getId()).getInstallments().stream().map(Installment::getId).sorted().toList();

    Transaction changes = draft("300.00", 3);
    changes.setId(saved.getId());
    changes.setNotes("bought on sale");
    transactionService.update(changes, category.getId());

    Transaction reloaded = reload(saved.getId());
    assertThat(reloaded.getNotes()).isEqualTo("bought on sale");
    assertThat(reloaded.getInstallments().stream().map(Installment::getId).sorted().toList())
        .isEqualTo(idsBefore);
  }

  @Test
  void paidEarlyInstallmentsCountInThePaymentMonthAndCanBeRestored() {
    signIn(alice);
    Category category = categoryService.save(category("Clinic", TransactionType.EXPENSE));
    Transaction saved = transactionService.save(draft("300.00", 3), category.getId());

    transactionService.payInstallmentsEarly(
        saved.getId(), List.of(2, 3), LocalDate.of(2026, 1, 20));

    var january =
        transactionService.findByTransactionTypeAndDateBetween(
            TransactionType.EXPENSE,
            LocalDate.of(2026, 1, 1),
            LocalDate.of(2026, 1, 31),
            "date",
            "asc",
            Pageable.ofSize(30));
    var march =
        transactionService.findByTransactionTypeAndDateBetween(
            TransactionType.EXPENSE,
            LocalDate.of(2026, 3, 1),
            LocalDate.of(2026, 3, 31),
            "date",
            "asc",
            Pageable.ofSize(30));
    assertThat(january.getContent()).extracting(Transaction::getId).contains(saved.getId());
    assertThat(march.getContent()).extracting(Transaction::getId).doesNotContain(saved.getId());

    transactionService.restoreInstallments(saved.getId(), List.of(3));

    assertThat(reload(saved.getId()).getInstallments())
        .filteredOn(installment -> installment.getInstallmentNumber() == 3)
        .singleElement()
        .satisfies(installment -> {
          assertThat(installment.isPaidEarly()).isFalse();
          assertThat(installment.getDueDate()).isEqualTo(LocalDate.of(2026, 3, 15));
        });
  }

  @Test
  void anotherUserCannotPayMyInstallmentsEarly() {
    signIn(alice);
    Category category = categoryService.save(category("Clinic", TransactionType.EXPENSE));
    Transaction saved = transactionService.save(draft("300.00", 3), category.getId());

    signIn(bob);
    assertError(
        () ->
            transactionService.payInstallmentsEarly(
                saved.getId(), List.of(3), LocalDate.of(2026, 1, 20)),
        ApplicationError.NOT_FOUND);
    assertError(
        () ->
            transactionService.payInstallmentsEarly(
                saved.getId(), List.of(), LocalDate.of(2026, 1, 20)),
        ApplicationError.BAD_REQUEST);
  }

  @Test
  void removingInstallmentsDeletesThem() {
    signIn(alice);
    Category category = categoryService.save(category("Course", TransactionType.EXPENSE));
    Transaction saved = transactionService.save(draft("200.00", 2), category.getId());

    Transaction changes = draft("200.00", null);
    changes.setId(saved.getId());
    transactionService.update(changes, category.getId());

    assertThat(reload(saved.getId()).getInstallments()).isEmpty();
  }

  @Test
  void usersCannotChangeOrDeleteAnotherUsersTransactions() {
    signIn(alice);
    Category category = categoryService.save(category("Car wash", TransactionType.EXPENSE));
    Transaction saved = transactionService.save(draft("10.00", null), category.getId());

    signIn(bob);
    Category bobCategory = categoryService.save(category("Car wash", TransactionType.EXPENSE));
    Transaction changes = draft("1.00", null);
    changes.setId(saved.getId());

    assertError(
        () -> transactionService.update(changes, bobCategory.getId()), ApplicationError.NOT_FOUND);
    assertError(() -> transactionService.deleteById(saved.getId()), ApplicationError.NOT_FOUND);
  }

  @Test
  void repeatingTransactionsCannotHaveInstallments() {
    signIn(alice);
    Category category = categoryService.save(category("Gym", TransactionType.EXPENSE));
    Transaction draft = draft("80.00", 2);
    draft.setRepeats(RepeatInterval.MONTHLY);

    assertError(
        () -> transactionService.save(draft, category.getId()), ApplicationError.BAD_REQUEST);
  }

  @Test
  void listingFindsInstallmentsDueInThePeriod() {
    signIn(alice);
    Category category = categoryService.save(category("TV", TransactionType.EXPENSE));
    Transaction saved = transactionService.save(draft("300.00", 3), category.getId());

    var march =
        transactionService.findByTransactionTypeAndDateBetween(
            TransactionType.EXPENSE,
            LocalDate.of(2026, 3, 1),
            LocalDate.of(2026, 3, 31),
            "date",
            "asc",
            Pageable.ofSize(30));

    assertThat(march.getContent()).extracting(Transaction::getId).containsExactly(saved.getId());
  }

  private Transaction reload(UUID id) {
    return transactionRepository.findAllWithCategoryAndInstallmentsByIdIn(List.of(id)).getFirst();
  }

  private static Category category(String name, TransactionType type) {
    return Category.builder().name(name).transactionType(type).build();
  }

  private static Transaction draft(String total, Integer installments) {
    return Transaction.builder()
        .totalValue(new BigDecimal(total))
        .installmentNumbers(installments)
        .date(LocalDate.of(2026, 1, 15))
        .build();
  }

  private static void assertError(Runnable action, ApplicationError expected) {
    assertThatThrownBy(action::run)
        .isInstanceOfSatisfying(
            ApplicationException.class,
            exception -> assertThat(exception.getError()).isEqualTo(expected));
  }
}
