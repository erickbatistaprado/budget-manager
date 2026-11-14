package com.budgetmanager.bm.support;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@SpringBootTest
@Import(PostgresContainerConfiguration.class)
public abstract class IntegrationTest {

  protected static final String PASSWORD = "Str0ng!Password";

  @Autowired protected UserService userService;

  protected User registerUser() {
    return userService.register(
        "Test user", "user-" + UUID.randomUUID() + "@example.com", PASSWORD);
  }

  protected void signIn(User user) {
    var authentication =
        new UsernamePasswordAuthenticationToken(
            user.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
  }

  @AfterEach
  void clearSecurityContext() {
    SecurityContextHolder.clearContext();
  }
}
