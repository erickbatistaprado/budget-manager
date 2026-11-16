package com.budgetmanager.bm.identity.infrastructure.http;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserRegistrationRequest(
    @Size(max = 50) String name, @Email @NotBlank String email, @NotBlank String password) {}
