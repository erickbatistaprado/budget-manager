package com.budgetmanager.bm.savings.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.savings.domain.*;
import com.budgetmanager.bm.savings.infrastructure.persistence.*;
import com.budgetmanager.bm.shared.application.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SavingMoneyService {
  private final SavingRepository repository;
  private final SavingValuationRepository valuations;
  private final UserService users;
  private final java.time.Clock clock;

  public Saving requireOwned(UUID id) {
    return repository
        .findByIdAndUserId(id, users.requireCurrentUser().getId())
        .orElseThrow(
            () -> new ApplicationException(ApplicationError.NOT_FOUND, "Saving not found"));
  }

  public Saving lockOwned(UUID id) {
    return repository
        .lockByIdAndUserId(id, users.requireCurrentUser().getId())
        .orElseThrow(
            () -> new ApplicationException(ApplicationError.NOT_FOUND, "Saving not found"));
  }

  @Transactional
  public void reconcile(UUID id, List<SavingValue.Contribution> contributions) {
    Saving saving =
        repository
            .lockByIdAndUserId(id, users.requireCurrentUser().getId())
            .orElseThrow(
                () -> new ApplicationException(ApplicationError.NOT_FOUND, "Saving not found"));
    BigDecimal value =
        SavingValue.at(LocalDate.now(clock), contributions, valuations.findBySavingId(id));
    if (value.signum() < 0) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Movement would leave a negative saving value");
    }
    saving.setAmount(value);
    repository.save(saving);
  }

  @Transactional
  public SavingValuation value(UUID id, LocalDate date, BigDecimal value) {
    lockOwned(id);
    if (date == null || value == null || value.signum() < 0) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Date and a non-negative value are required");
    }
    SavingValuation valuation =
        valuations.findBySavingId(id).stream()
            .filter(existing -> existing.getDate().equals(date))
            .findFirst()
            .orElseGet(SavingValuation::new);
    valuation.setSavingId(id);
    valuation.setDate(date);
    valuation.setValue(value);
    valuations.saveAndFlush(valuation);

    return valuation;
  }

  @Transactional(readOnly = true)
  public List<SavingValuation> valuations(List<UUID> savingIds) {
    return valuations.findOwnedBySavingIds(savingIds, users.requireCurrentUser().getId());
  }

  @Transactional(readOnly = true)
  public List<SavingValuation> valuations() {
    return valuations.findBySavingIdIn(
        repository
            .findAllByUserIdOrderByLocationAscNameAsc(users.requireCurrentUser().getId())
            .stream()
            .map(Saving::getId)
            .toList());
  }
}
