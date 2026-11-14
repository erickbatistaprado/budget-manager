package com.budgetmanager.bm.identity.application;

import com.budgetmanager.bm.identity.domain.Role;
import com.budgetmanager.bm.identity.domain.UserRole;
import com.budgetmanager.bm.identity.infrastructure.persistence.RoleRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoleService {

  private final RoleRepository repository;

  public Role save(Role role) {
    return repository.save(role);
  }

  public Role findByRoleName(UserRole userRole) {
    return repository
        .findByRoleName(userRole)
        .orElseThrow(() ->
            new ApplicationException(
                ApplicationError.NOT_FOUND, "Role not found for {}", userRole));
  }
}
