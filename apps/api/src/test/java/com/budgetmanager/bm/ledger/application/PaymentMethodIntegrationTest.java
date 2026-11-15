package com.budgetmanager.bm.ledger.application;

import static org.assertj.core.api.Assertions.*;

import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.budgetmanager.bm.support.IntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

class PaymentMethodIntegrationTest extends IntegrationTest {
  @Autowired private AccountService accounts;
  @Autowired private CardService cards;
  @Autowired private CategoryService categories;
  @Autowired private TransactionService transactions;
  @Autowired private TransactionRepository repository;
  @Autowired private TransactionTemplate template;

  @Test
  void savesEveryMethodAndMonthlyAccountsAndClearsDeletedAccountReferences() {
    signIn(registerUser());
    Account account = accounts.save(null, "Bradesco checking", Bank.BRADESCO);
    Card card = cards.save(null, "Nubank", 25, 5, Bank.NUBANK);
    Category category = categories.findByTransactionType(TransactionType.EXPENSE).getFirst();
    for (PaymentMethod method : PaymentMethod.values()) {
      Transaction draft = draft();
      draft.setPaymentMethod(method);
      if (method == PaymentMethod.CREDIT_CARD) {
        draft.setCard(card);
      } else if (method != PaymentMethod.CASH && method != PaymentMethod.OTHER) {
        draft.setAccount(account);
      }
      Transaction saved = transactions.save(draft, category.getId());
      template.executeWithoutResult(status -> {
        Transaction stored = repository.findById(saved.getId()).orElseThrow();
        assertThat(stored.getPaymentMethod()).isEqualTo(method);
        assertThat(stored.getAccount() == null).isEqualTo(draft.getAccount() == null);
      });
    }
    Transaction monthly = draft();
    monthly.setRepeats(RepeatInterval.MONTHLY);
    monthly.setPaymentMethod(PaymentMethod.BOLETO);
    monthly.setAccount(account);
    Transaction saved = transactions.save(monthly, category.getId());
    transactions.changeMonth(
        saved.getId(),
        YearMonth.of(2026, 11),
        BigDecimal.ONE,
        LocalDate.of(2026, 11, 4),
        "Changed");
    Transaction loaded =
        transactions
            .findByTransactionTypeAndDateBetween(
                TransactionType.EXPENSE,
                LocalDate.of(2026, 11, 1),
                LocalDate.of(2026, 11, 30),
                "date",
                "asc",
                org.springframework.data.domain.PageRequest.of(0, 100))
            .getContent()
            .stream()
            .filter(transaction -> transaction.getId().equals(saved.getId()))
            .findFirst()
            .orElseThrow();
    assertThat(loaded.getAccount().getName()).isEqualTo(account.getName());
    assertThat(loaded.getPaymentMethod()).isEqualTo(PaymentMethod.BOLETO);
    accounts.delete(account.getId());
    template.executeWithoutResult(status -> {
      Transaction retained = repository.findById(saved.getId()).orElseThrow();
      assertThat(retained.getAccount()).isNull();
      assertThat(retained.getPaymentMethod()).isEqualTo(PaymentMethod.BOLETO);
    });
  }

  @Test
  void rejectsAnotherOwnersAccountAndDuplicateNames() {
    signIn(registerUser());
    Account account = accounts.save(null, "Nubank", Bank.NUBANK);
    assertThatThrownBy(() -> accounts.save(null, " nubank ", Bank.NUBANK))
        .isInstanceOf(ApplicationException.class);
    signIn(registerUser());
    Category category = categories.findByTransactionType(TransactionType.EXPENSE).getFirst();
    Transaction draft = draft();
    draft.setPaymentMethod(PaymentMethod.PIX);
    draft.setAccount(account);
    assertThatThrownBy(() -> transactions.save(draft, category.getId()))
        .isInstanceOf(ApplicationException.class)
        .hasMessageContaining("Account not found");
    assertThatThrownBy(() -> accounts.delete(account.getId()))
        .isInstanceOf(ApplicationException.class);
  }

  private Transaction draft() {
    return Transaction.builder()
        .date(LocalDate.of(2026, 11, 1))
        .totalValue(BigDecimal.TEN)
        .repeats(RepeatInterval.NONE)
        .build();
  }
}
