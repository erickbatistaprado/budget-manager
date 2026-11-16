package com.budgetmanager.bm.identity.infrastructure.http;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Set;
import java.util.UUID;
import lombok.Builder;

@Builder
public record UserDto(
    UUID id,
    @Size(max = 50) String name,
    @Email @NotBlank String email,
    Set<RoleDto> roles,
    Integer salaryDay) {

  public UserDto {
    roles = roles == null ? Set.of() : Set.copyOf(roles);
  }
}
