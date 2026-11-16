package com.budgetmanager.bm.identity.application;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.identity.domain.UserRegistered;
import com.budgetmanager.bm.identity.domain.UserRole;
import com.budgetmanager.bm.identity.infrastructure.persistence.UserRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.budgetmanager.bm.utils.Checkers;
import java.util.Collections;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

  private final UserRepository repository;
  private final PasswordEncoder encoder;
  private final RoleService roleService;
  private final RefreshTokenService refreshTokenService;
  private final ApplicationEventPublisher events;

  @Transactional
  public User register(String name, String email, String password) {
    repository
        .findByEmail(email)
        .ifPresent(existing -> {
          throw new ApplicationException(ApplicationError.CONFLICT, "Email already registered");
        });
    requireValidPassword(password);

    User user =
        User.builder()
            .name(name)
            .email(email)
            .password(encoder.encode(password))
            .roles(Collections.singleton(roleService.findByRoleName(UserRole.ROLE_USER)))
            .build();
    User saved = repository.save(user);
    events.publishEvent(new UserRegistered(saved.getId()));
    return saved;
  }

  @Transactional
  public void updateProfile(
      String name, String password, String currentPassword, String refreshToken) {
    User user = requireCurrentUser();
    if (password != null && !password.isBlank()) {
      if (currentPassword == null
          || currentPassword.isBlank()
          || currentPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72
          || !encoder.matches(currentPassword, user.getPassword())) {
        throw new ApplicationException(
            ApplicationError.BAD_REQUEST, "Current password is missing or incorrect");
      }
      requireValidPassword(password);
      if (encoder.matches(password, user.getPassword())) {
        throw new ApplicationException(
            ApplicationError.BAD_REQUEST, "Password must be different from before");
      }
      user.setPassword(encoder.encode(password));
      refreshTokenService.revokeOthers(user.getId(), refreshToken);
    }
    if (name != null && !name.isBlank()) {
      user.setName(name.trim());
    }
    repository.save(user);
  }

  @Transactional
  public void updatePreferences(Integer salaryDay) {
    if (salaryDay != null && (salaryDay < 1 || salaryDay > 31)) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Salary day must be between 1 and 31");
    }
    User user = requireCurrentUser();
    user.setSalaryDay(salaryDay);
    repository.save(user);
  }

  @Transactional
  public void updateGoalPace(java.math.BigDecimal pace) {
    if (pace != null && pace.signum() < 0) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "Pace cannot be negative");
    }
    User user = lockCurrentUser();
    user.setGoalMonthlyPace(pace);
    repository.save(user);
  }

  @Transactional
  public User lockCurrentUser() {
    return repository.lockById(requireCurrentUser().getId()).orElseThrow();
  }

  @Transactional
  public void updateMainAccount(UUID accountId) {
    User user = lockCurrentUser();
    user.setMainAccountId(accountId);
    repository.save(user);
  }

  public Optional<User> findByEmail(String email) {
    return repository.findByEmail(email);
  }

  public User findById(UUID id) {
    return repository
        .findById(id)
        .orElseThrow(() ->
            new ApplicationException(ApplicationError.NOT_FOUND, "User not found for {}", id));
  }

  public Optional<User> getCurrentUser() {
    return repository.findByEmail(getCurrentUsername());
  }

  public User requireCurrentUser() {
    return getCurrentUser().orElseThrow(() -> new UsernameNotFoundException("User not found"));
  }

  public String getCurrentUsername() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();

    if (auth == null || !auth.isAuthenticated()) {
      throw new UsernameNotFoundException("User not authenticated");
    }
    return auth.getName();
  }

  private static void requireValidPassword(String password) {
    if (!Checkers.isPasswordCorrect(password)) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, Checkers.PASSWORD_RULE);
    }
  }
}
