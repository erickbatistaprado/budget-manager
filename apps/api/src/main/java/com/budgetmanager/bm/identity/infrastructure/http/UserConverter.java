package com.budgetmanager.bm.identity.infrastructure.http;

import com.budgetmanager.bm.identity.domain.User;
import java.util.Set;
import java.util.stream.Collectors;

public final class UserConverter {

  private UserConverter() {}

  public static UserDto entityToDto(User entity) {
    return UserDto.builder()
        .id(entity.getId())
        .email(entity.getEmail())
        .name(entity.getName())
        .salaryDay(entity.getSalaryDay())
        .mainAccountId(entity.getMainAccountId())
        .goalMonthlyPace(entity.getGoalMonthlyPace())
        .roles(checkRoles(entity))
        .build();
  }

  public static Set<RoleDto> checkRoles(User user) {
    if (user.getRoles() != null) {
      return user.getRoles().stream().map(RoleConverter::entityToDto).collect(Collectors.toSet());
    }
    return Set.of();
  }
}
