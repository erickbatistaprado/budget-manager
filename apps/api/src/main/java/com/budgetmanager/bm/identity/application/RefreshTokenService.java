package com.budgetmanager.bm.identity.application;

import com.budgetmanager.bm.identity.domain.RefreshToken;
import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.identity.infrastructure.persistence.RefreshTokenRepository;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh tokens are opaque random strings handed to the client once. Only their SHA-256 hash is
 * stored, so a database leak does not hand out working sessions. Each sign-in creates its own
 * token, so every device keeps its own session.
 */
@Service
public class RefreshTokenService {

  private static final int TOKEN_BYTES = 32;

  private final RefreshTokenRepository repository;
  private final Clock clock;
  private final long refreshExpirationMillis;
  private final SecureRandom secureRandom = new SecureRandom();

  public RefreshTokenService(
      RefreshTokenRepository repository,
      Clock clock,
      @Value("${jwt.refresh-expiration}") long refreshExpirationMillis) {
    this.repository = repository;
    this.clock = clock;
    this.refreshExpirationMillis = refreshExpirationMillis;
  }

  public record IssuedToken(String token, String email, List<String> roles) {

    public IssuedToken {
      roles = List.copyOf(roles);
    }

    static IssuedToken of(String token, User user) {
      return new IssuedToken(
          token,
          user.getEmail(),
          user.getRoles().stream().map(role -> role.getRoleName().toString()).toList());
    }
  }

  @Transactional
  public IssuedToken issue(User user) {
    Instant now = clock.instant();
    repository.deleteExpiredByUserId(user.getId(), now);

    String token = newToken();
    repository.save(
        RefreshToken.builder()
            .tokenHash(hash(token))
            .user(user)
            .expiryDate(now.plusMillis(refreshExpirationMillis))
            .build());
    return IssuedToken.of(token, user);
  }

  @Transactional
  public IssuedToken rotate(String presentedToken) {
    if (presentedToken == null || presentedToken.isBlank()) {
      throw invalidToken();
    }
    Instant now = clock.instant();
    String newToken = newToken();
    String newTokenHash = hash(newToken);
    int rotated =
        repository.rotate(
            hash(presentedToken), newTokenHash, now.plusMillis(refreshExpirationMillis), now);
    if (rotated != 1) {
      throw invalidToken();
    }
    User user =
        repository
            .findWithUserByTokenHash(newTokenHash)
            .map(RefreshToken::getUser)
            .orElseThrow(RefreshTokenService::invalidToken);
    return IssuedToken.of(newToken, user);
  }

  @Transactional
  public void revoke(String presentedToken) {
    if (presentedToken != null && !presentedToken.isBlank()) {
      repository.deleteByTokenHash(hash(presentedToken));
    }
  }

  @Transactional
  public void revokeAll(UUID userId) {
    repository.deleteAllByUserId(userId);
  }

  private String newToken() {
    byte[] bytes = new byte[TOKEN_BYTES];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  static String hash(String token) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is not available", exception);
    }
  }

  private static ApplicationException invalidToken() {
    return new ApplicationException(
        ApplicationError.UNAUTHORIZED, "Invalid or expired refresh token");
  }
}
