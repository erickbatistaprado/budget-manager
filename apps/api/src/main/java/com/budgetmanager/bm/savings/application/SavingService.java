package com.budgetmanager.bm.savings.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.savings.domain.Saving;
import com.budgetmanager.bm.savings.infrastructure.persistence.SavingRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SavingService {

  private final SavingRepository repository;
  private final UserService userService;

  @Transactional(readOnly = true)
  public List<Saving> findAll() {
    User user = getCurrentUser();
    return repository.findAllByUserIdOrderByLocationAscNameAsc(user.getId());
  }

  @Transactional
  public Saving save(Saving draft) {
    Saving saving =
        Saving.builder()
            .name(draft.getName().trim())
            .amount(draft.getAmount())
            .user(getCurrentUser())
            .build();
    place(saving, draft);
    return repository.saveAndFlush(saving);
  }

  @Transactional
  public Saving update(Saving changes) {
    User user = getCurrentUser();

    if (changes.getId() == null) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Saving id is required");
    }
    Saving saving =
        repository
            .findByIdAndUserId(changes.getId(), user.getId())
            .orElseThrow(() ->
                new ApplicationException(
                    ApplicationError.NOT_FOUND, "Saving not found for {}", changes.getId()));
    saving.setName(changes.getName().trim());
    saving.setAmount(changes.getAmount());
    place(saving, changes);
    return repository.saveAndFlush(saving);
  }

  private static void place(Saving saving, Saving requested) {
    try {
      saving.place(requested.getLocation(), requested.getInvestmentType());
    } catch (IllegalArgumentException exception) {
      throw new ApplicationException(
          exception, ApplicationError.BAD_REQUEST, exception.getMessage());
    }
  }

  @Transactional
  public void deleteById(UUID id) {
    User user = getCurrentUser();
    Saving saving =
        repository
            .findByIdAndUserId(id, user.getId())
            .orElseThrow(() ->
                new ApplicationException(
                    ApplicationError.NOT_FOUND, "Saving not found for {}", id));
    repository.delete(saving);
  }

  private User getCurrentUser() {
    return userService.requireCurrentUser();
  }
}
