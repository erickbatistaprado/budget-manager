package com.budgetmanager.bm.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.support.PostgresContainerConfiguration;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

/**
 * Runs on a real servlet container, because MockMvc neither forwards errors to {@code /error} nor
 * round-trips cookies the way a browser does.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresContainerConfiguration.class)
class CsrfServerTest {

  private static final String PASSWORD = "Str0ng!Password";
  private static final Pattern TOKEN = Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"");

  @LocalServerPort private int port;
  @Autowired private UserService userService;

  private HttpClient browser;

  @BeforeEach
  void signIn() throws Exception {
    browser = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
    String email = "csrf-" + UUID.randomUUID() + "@example.com";
    userService.register("Csrf", email, PASSWORD);
    HttpResponse<String> login =
        send(
            "POST",
            "/auth/login",
            """
            {"email": "%s", "password": "%s"}
            """
                .formatted(email, PASSWORD),
            null);
    assertThat(login.statusCode()).isEqualTo(200);
  }

  @Test
  void oneCsrfTokenWorksForSeveralRequests() throws Exception {
    String csrfToken = csrfToken();

    assertThat(createCategory("Food", csrfToken).statusCode()).isEqualTo(201);
    assertThat(createCategory("Rent", csrfToken).statusCode()).isEqualTo(201);
    assertThat(createCategory("Gym", csrfToken).statusCode()).isEqualTo(201);
  }

  @Test
  void aMissingCsrfTokenIsForbiddenNotUnauthorized() throws Exception {
    csrfToken();

    assertThat(createCategory("Trips", null).statusCode()).isEqualTo(403);
  }

  private HttpResponse<String> createCategory(String name, String csrfToken) throws Exception {
    return send(
        "POST",
        "/categories",
        """
        {"name": "%s", "transactionType": "EXPENSE"}
        """
            .formatted(name),
        csrfToken);
  }

  private String csrfToken() throws Exception {
    Matcher matcher = TOKEN.matcher(send("GET", "/auth/csrf", null, null).body());
    assertThat(matcher.find()).isTrue();
    return matcher.group(1);
  }

  private HttpResponse<String> send(String method, String path, String body, String csrfToken)
      throws Exception {
    HttpRequest.Builder request =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .method(
                method,
                body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .header("Content-Type", "application/json");
    if (csrfToken != null) {
      request.header("X-CSRF-Token", csrfToken);
    }
    return browser.send(request.build(), HttpResponse.BodyHandlers.ofString());
  }
}
