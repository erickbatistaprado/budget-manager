package com.budgetmanager.bm.identity.infrastructure.http;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UserPreferencesRequest(@Min(1) @Max(31) Integer salaryDay) {}
