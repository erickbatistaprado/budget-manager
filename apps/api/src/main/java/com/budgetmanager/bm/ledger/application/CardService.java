package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Card;
import com.budgetmanager.bm.ledger.infrastructure.persistence.CardRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CardService {
  private final CardRepository repository;
  private final UserService userService;

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
    User user = userService.requireCurrentUser();
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
    card.setName(name.trim());
    card.setClosingDay(closingDay);
    card.setDueDay(dueDay);
    return repository.saveAndFlush(card);
  }

  @Transactional
  public void delete(UUID id) {
    repository.delete(requireOwned(id, userService.requireCurrentUser()));
  }
}
