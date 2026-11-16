package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Bank;
import com.budgetmanager.bm.ledger.domain.Card;
import com.budgetmanager.bm.ledger.domain.Movement;
import com.budgetmanager.bm.ledger.domain.MovementKind;
import com.budgetmanager.bm.ledger.domain.PaymentMethod;
import com.budgetmanager.bm.ledger.infrastructure.persistence.CardRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CardService {
  private final CardRepository repository;
  private final AccountService accounts;
  private final UserService userService;
  private final com.budgetmanager.bm.ledger.infrastructure.persistence.MovementRepository movements;

  @Transactional(readOnly = true)
  public List<Card> list() {
    return repository.findByUserIdOrderByNameAsc(userService.requireCurrentUser().getId());
  }

  public Card requireOwned(UUID id, User user) {
    return repository
        .findByIdAndUserId(id, user.getId())
        .orElseThrow(() -> new ApplicationException(ApplicationError.NOT_FOUND, "Card not found"));
  }

  @Transactional
  public Card save(UUID id, String name, int closingDay, int dueDay) {
    return save(id, name, closingDay, dueDay, Bank.OTHER);
  }

  @Transactional
  public Card save(UUID id, String name, int closingDay, int dueDay, Bank bank) {
    return save(id, name, closingDay, dueDay, bank, null, null);
  }

  @Transactional
  public Card save(
      UUID id,
      String name,
      int closingDay,
      int dueDay,
      Bank bank,
      UUID paymentAccountId,
      UUID fundingAccountId) {
    return save(id, name, closingDay, dueDay, bank, paymentAccountId, fundingAccountId, null);
  }

  @Transactional
  public Card save(
      UUID id,
      String name,
      int closingDay,
      int dueDay,
      Bank bank,
      UUID paymentAccountId,
      UUID fundingAccountId,
      BigDecimal creditLimit) {
    return save(
        id, name, closingDay, dueDay, bank, paymentAccountId, fundingAccountId, creditLimit, null);
  }

  @Transactional
  public Card save(
      UUID id,
      String name,
      int closingDay,
      int dueDay,
      Bank bank,
      UUID paymentAccountId,
      UUID fundingAccountId,
      BigDecimal creditLimit,
      PaymentMethod billPaymentMethod) {
    if (billPaymentMethod != null
        && !Movement.supportsPaymentMethod(MovementKind.CARD_BILL_PAYMENT, billPaymentMethod)) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Invalid bill payment method");
    }
    User user = userService.requireCurrentUser();
    if (creditLimit != null
        && (creditLimit.signum() <= 0
            || creditLimit.scale() > 2
            || creditLimit.precision() - creditLimit.scale() > 17)) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Credit limit must be positive with at most two decimals");
    }
    if (fundingAccountId != null
        && (paymentAccountId == null || fundingAccountId.equals(paymentAccountId))) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Funding account must differ from the payment account");
    }
    Card card = id == null ? Card.builder().user(user).build() : requireOwned(id, user);
    if (name == null
        || name.isBlank()
        || name.trim().length() > 255
        || closingDay < 1
        || closingDay > 31
        || dueDay < 1
        || dueDay > 31) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Name and days between 1 and 31 are required");
    }
    repository
        .findByUserIdAndNameIgnoreCase(user.getId(), name.trim())
        .ifPresent(existing -> {
          if (!existing.getId().equals(id)) {
            throw new ApplicationException(
                ApplicationError.BAD_REQUEST, "A card with this name already exists");
          }
        });
    if (bank == null) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Bank is required");
    }
    card.setPaymentAccount(
        paymentAccountId == null ? null : accounts.requireOwned(paymentAccountId, user));
    card.setFundingAccount(
        fundingAccountId == null ? null : accounts.requireOwned(fundingAccountId, user));
    card.setBillPaymentMethod(paymentAccountId == null ? null : billPaymentMethod);
    card.setCreditLimit(creditLimit);
    card.setBank(bank);
    card.setName(name.trim());
    card.setClosingDay(closingDay);
    card.setDueDay(dueDay);
    return repository.saveAndFlush(card);
  }

  @Transactional
  public void delete(UUID id) {
    var owned = requireOwned(id, userService.requireCurrentUser());
    if (movements.existsByCardId(id)) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Card is referenced by movements; remove them first");
    }
    repository.delete(owned);
  }
}
