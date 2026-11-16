package com.budgetmanager.bm.identity.infrastructure.http;

import jakarta.validation.constraints.Size;

public record UserUpdateRequest(
    @Size(max = 50) String name, String password, String currentPassword) {}
