package com.budgetmanager.bm.identity.domain;

import java.util.UUID;

/**
 * Published inside the registration transaction, so other contexts can prepare the new user's data
 * without identity knowing about it. A listener that fails rolls the registration back.
 */
public record UserRegistered(UUID userId) {}
