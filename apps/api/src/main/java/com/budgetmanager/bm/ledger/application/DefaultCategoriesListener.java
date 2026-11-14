package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.domain.UserRegistered;
import com.budgetmanager.bm.ledger.infrastructure.persistence.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Gives every new user the default categories seeded in {@code t_default_category}. */
@Component
@RequiredArgsConstructor
public class DefaultCategoriesListener {

  private final CategoryRepository categoryRepository;

  @EventListener
  public void onUserRegistered(UserRegistered event) {
    categoryRepository.addDefaultCategories(event.userId());
  }
}
