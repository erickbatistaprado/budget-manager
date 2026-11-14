package com.budgetmanager.bm.identity.application;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.identity.infrastructure.security.JwtUtil;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final UserService userService;
  private final RefreshTokenService refreshTokenService;
  private final PasswordEncoder passwordEncoder;
  private final JwtUtil jwtUtil;

  /** Checked when the email is unknown, so both failures take the same time. */
  private final String timingGuardHash;

  public AuthService(
      UserService userService,
      RefreshTokenService refreshTokenService,
      PasswordEncoder passwordEncoder,
      JwtUtil jwtUtil) {
    this.userService = userService;
    this.refreshTokenService = refreshTokenService;
    this.passwordEncoder = passwordEncoder;
    this.jwtUtil = jwtUtil;
    this.timingGuardHash = passwordEncoder.encode(UUID.randomUUID().toString());
  }

  public record Session(String accessToken, String refreshToken) {}

  @Transactional
  public Session login(String email, String password) {
    User user = userService.findByEmail(email).orElse(null);
    String passwordHash = user == null ? timingGuardHash : user.getPassword();
    boolean passwordMatches =
        passwordHash != null && passwordEncoder.matches(password, passwordHash);
    if (user == null || !passwordMatches) {
      throw new ApplicationException(ApplicationError.UNAUTHORIZED, "Invalid credentials");
    }
    return sessionFor(refreshTokenService.issue(user));
  }

  @Transactional
  public Session refresh(String refreshToken) {
    return sessionFor(refreshTokenService.rotate(refreshToken));
  }

  @Transactional
  public void logout(String refreshToken) {
    refreshTokenService.revoke(refreshToken);
  }

  private Session sessionFor(RefreshTokenService.IssuedToken issuedToken) {
    return new Session(
        jwtUtil.generateAccessToken(issuedToken.email(), issuedToken.roles()), issuedToken.token());
  }
}
