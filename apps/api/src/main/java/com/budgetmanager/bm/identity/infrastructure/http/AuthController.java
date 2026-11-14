package com.budgetmanager.bm.identity.infrastructure.http;

import static org.springframework.http.ResponseEntity.ok;

import com.budgetmanager.bm.identity.application.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

  static final String REFRESH_COOKIE_NAME = "refresh_token";
  static final String ACCESS_COOKIE_NAME = "access_token";

  private final AuthService authService;
  private final long refreshExpiration;
  private final long accessExpiration;
  private final boolean secureCookies;

  public AuthController(
      AuthService authService,
      @Value("${jwt.refresh-expiration}") long refreshExpiration,
      @Value("${jwt.access-expiration}") long accessExpiration,
      @Value("${cookies.secure}") boolean secureCookies) {
    this.authService = authService;
    this.refreshExpiration = refreshExpiration;
    this.accessExpiration = accessExpiration;
    this.secureCookies = secureCookies;
  }

  @PostMapping("/login")
  public ResponseEntity<Map<String, String>> login(
      @Valid @RequestBody AuthRequest authRequest, HttpServletResponse response) {
    writeSession(response, authService.login(authRequest.email(), authRequest.password()));
    return ok(Map.of("message", "Logged in"));
  }

  @PostMapping("/refresh")
  public ResponseEntity<Map<String, String>> refresh(
      HttpServletRequest request, HttpServletResponse response) {
    // A failed refresh leaves the cookies alone: another tab may have just rotated the same token,
    // and clearing here would erase the session it received.
    writeSession(response, authService.refresh(getCookieValue(request, REFRESH_COOKIE_NAME)));
    return ok(Map.of("message", "Refreshed"));
  }

  @PostMapping("/logout")
  public ResponseEntity<Map<String, String>> logout(
      HttpServletRequest request, HttpServletResponse response) {
    authService.logout(getCookieValue(request, REFRESH_COOKIE_NAME));
    clearSession(response);
    return ok(Map.of("message", "Logged out"));
  }

  @GetMapping("/csrf")
  public ResponseEntity<Map<String, String>> csrf(CsrfToken csrfToken) {
    return ok(Map.of("token", csrfToken.getToken()));
  }

  private void writeSession(HttpServletResponse response, AuthService.Session session) {
    writeCookie(response, REFRESH_COOKIE_NAME, session.refreshToken(), refreshExpiration);
    writeCookie(response, ACCESS_COOKIE_NAME, session.accessToken(), accessExpiration);
  }

  private void clearSession(HttpServletResponse response) {
    writeCookie(response, REFRESH_COOKIE_NAME, "", 0);
    writeCookie(response, ACCESS_COOKIE_NAME, "", 0);
  }

  private void writeCookie(HttpServletResponse response, String name, String value, long maxAge) {
    ResponseCookie cookie =
        ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(secureCookies)
            .path("/")
            .sameSite("Lax")
            .maxAge(Duration.ofMillis(maxAge))
            .build();

    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  private static String getCookieValue(HttpServletRequest request, String name) {
    if (request.getCookies() == null) {
      return null;
    }
    for (Cookie cookie : request.getCookies()) {
      if (name.equals(cookie.getName())) {
        return cookie.getValue();
      }
    }
    return null;
  }
}
