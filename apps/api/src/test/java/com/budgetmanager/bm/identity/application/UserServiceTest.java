package com.budgetmanager.bm.identity.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.identity.infrastructure.persistence.UserRepository;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserServiceTest {
  private final UserRepository repository = mock(UserRepository.class);
  private final PasswordEncoder encoder = mock(PasswordEncoder.class);
  private final RefreshTokenService sessions = mock(RefreshTokenService.class);
  private final UserService service =
      new UserService(
          repository,
          encoder,
          mock(RoleService.class),
          sessions,
          mock(ApplicationEventPublisher.class));
  private final User owner =
      User.builder()
          .id(UUID.randomUUID())
          .email("owner@example.com")
          .name("Owner")
          .password("hash")
          .build();

  @BeforeEach
  void authenticate() {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(owner.getEmail(), null, java.util.List.of()));
    when(repository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
  }

  @AfterEach
  void clearAuthentication() {
    SecurityContextHolder.clearContext();
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"wrong", " "})
  void missingAndWrongCurrentPasswordsGiveTheSameError(String currentPassword) {
    assertThatThrownBy(
            () -> service.updateProfile("Changed", "N3w!Password", currentPassword, "session"))
        .isInstanceOf(ApplicationException.class)
        .hasMessage("Current password is missing or incorrect");
    assertThat(owner.getPassword()).isEqualTo("hash");
    assertThat(owner.getName()).isEqualTo("Owner");
    verifyNoInteractions(sessions);
    verify(repository, never()).save(owner);
  }

  @Test
  void changesPasswordAndPreservesCurrentRefreshSession() {
    when(encoder.matches("current", "hash")).thenReturn(true);
    when(encoder.encode("N3w!Password")).thenReturn("new-hash");
    service.updateProfile(null, "N3w!Password", "current", "session");
    assertThat(owner.getPassword()).isEqualTo("new-hash");
    verify(sessions).revokeOthers(owner.getId(), "session");
    verify(repository).save(owner);
  }

  @Test
  void nameOnlyNeedsNoPassword() {
    service.updateProfile(" New name ", null, null, null);
    assertThat(owner.getName()).isEqualTo("New name");
    verifyNoInteractions(encoder, sessions);
    verify(repository).save(owner);
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 32, -1})
  void rejectsInvalidSalaryDays(int salaryDay) {
    assertThatThrownBy(() -> service.updatePreferences(salaryDay))
        .isInstanceOf(ApplicationException.class);
    verify(repository, never()).save(owner);
  }

  @ParameterizedTest
  @ValueSource(ints = {1, 31})
  void savesAndClearsSalaryDay(int salaryDay) {
    service.updatePreferences(salaryDay);
    assertThat(owner.getSalaryDay()).isEqualTo(salaryDay);
    service.updatePreferences(null);
    assertThat(owner.getSalaryDay()).isNull();
  }

  @Test
  void updatesMainAccountAndGoalPace() {
    when(repository.lockById(owner.getId())).thenReturn(Optional.of(owner));
    UUID accountId = UUID.randomUUID();
    service.updateMainAccount(accountId);
    assertThat(owner.getMainAccountId()).isEqualTo(accountId);
    service.updateGoalPace(new java.math.BigDecimal("250.00"));
    assertThat(owner.getGoalMonthlyPace()).isEqualByComparingTo("250.00");
    service.updateGoalPace(null);
    assertThat(owner.getGoalMonthlyPace()).isNull();
    assertThatThrownBy(() -> service.updateGoalPace(new java.math.BigDecimal("-1")))
        .isInstanceOf(ApplicationException.class);
  }
}
