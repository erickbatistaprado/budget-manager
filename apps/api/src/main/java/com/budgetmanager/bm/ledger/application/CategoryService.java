package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.infrastructure.persistence.CategoryRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CategoryService {

  private final CategoryRepository repository;
  private final UserService userService;

  @Transactional
  public Category save(Category draft) {
    return saveAll(List.of(draft)).getFirst();
  }

  @Transactional
  public List<Category> saveAll(List<Category> drafts) {
    if (drafts == null || drafts.isEmpty()) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "At least one category is required");
    }
    User user = userService.requireCurrentUser();
    Set<String> namesInRequest = new HashSet<>();
    List<Category> categories =
        drafts.stream()
            .map(draft -> {
              String name = draft.getName() == null ? "" : draft.getName().trim();
              if (name.isEmpty()) {
                throw new ApplicationException(
                    ApplicationError.BAD_REQUEST, "Category name is required");
              }
              String key = draft.getTransactionType() + ":" + name.toLowerCase(Locale.ROOT);
              if (!namesInRequest.add(key)
                  || repository.existsByUserIdAndTransactionTypeAndNameIgnoreCase(
                      user.getId(), draft.getTransactionType(), name)) {
                throw new ApplicationException(
                    ApplicationError.CONFLICT, "Category {} already exists", name);
              }
              return Category.builder()
                  .user(user)
                  .name(name)
                  .fixedCost(draft.getFixedCost())
                  .transactionType(draft.getTransactionType())
                  .build();
            })
            .toList();
    return repository.saveAll(categories);
  }

  @Transactional(readOnly = true)
  public List<Category> findByTransactionType(TransactionType transactionType) {
    return repository.findByUserIdAndTransactionTypeOrderByNameAsc(
        userService.requireCurrentUser().getId(), transactionType);
  }

  @Transactional
  public Category setFixedCost(UUID id, Boolean fixedCost) {
    Category category = requireOwned(id, userService.requireCurrentUser());
    category.setFixedCost(fixedCost);
    return repository.save(category);
  }

  public Category requireOwned(UUID categoryId, User owner) {
    if (categoryId == null) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Category id is required");
    }
    return repository
        .findByIdAndUserId(categoryId, owner.getId())
        .orElseThrow(() ->
            new ApplicationException(
                ApplicationError.NOT_FOUND, "Category not found for {}", categoryId));
  }
}
