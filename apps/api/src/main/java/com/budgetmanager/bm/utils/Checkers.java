package com.budgetmanager.bm.utils;

import java.nio.charset.StandardCharsets;

public final class Checkers {

  public static final int MIN_PASSWORD_LENGTH = 8;
  public static final int MAX_PASSWORD_BYTES = 72;
  public static final String PASSWORD_RULE =
      "Password must be at least 8 characters, at most 72 bytes, and include an uppercase"
          + " letter, a lowercase letter, a digit and a symbol";

  private Checkers() {}

  /**
   * Accepts any symbol, including spaces and characters outside ASCII. The 72-byte cap is BCrypt's
   * input limit: Spring Security rejects longer passwords instead of truncating them.
   */
  public static boolean isPasswordCorrect(String password) {
    if (password == null) {
      return false;
    }
    if (password.codePointCount(0, password.length()) < MIN_PASSWORD_LENGTH
        || password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
      return false;
    }
    return password.codePoints().anyMatch(Character::isUpperCase)
        && password.codePoints().anyMatch(Character::isLowerCase)
        && password.codePoints().anyMatch(Character::isDigit)
        && password.codePoints().anyMatch(codePoint -> !Character.isLetterOrDigit(codePoint));
  }
}
