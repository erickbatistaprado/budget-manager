package com.budgetmanager.bm.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.budgetmanager.bm.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

@AutoConfigureMockMvc
class AuthIntegrationTest extends IntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private AuthService authService;

  @Test
  void protectedEndpointsAnswer401WithoutASession() throws Exception {
    mockMvc.perform(get("/users/current")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(get("/users/current").cookie(new Cookie("access_token", "not-a-jwt")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void healthIsPublicForLoadBalancers() throws Exception {
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    mockMvc.perform(get("/actuator/info")).andExpect(status().isUnauthorized());
  }

  @Test
  void aStaleAccessCookieDoesNotBlockPublicEndpoints() throws Exception {
    String email = "user-" + UUID.randomUUID() + "@example.com";

    mockMvc
        .perform(
            post("/users")
                .cookie(new Cookie("access_token", "expired-or-garbage"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name": "New user", "email": "%s", "password": "%s"}
                    """
                        .formatted(email, PASSWORD)))
        .andExpect(status().isCreated());

    login(email, new Cookie("access_token", "expired-or-garbage"));
  }

  @Test
  void eachDeviceKeepsItsOwnSession() throws Exception {
    User user = registerUser();

    Cookie webRefresh = login(user.getEmail()).getResponse().getCookie("refresh_token");
    Cookie phoneRefresh = login(user.getEmail()).getResponse().getCookie("refresh_token");

    assertThat(webRefresh.getValue()).isNotEqualTo(phoneRefresh.getValue());
    refresh(webRefresh).andExpect(status().isOk());
    refresh(phoneRefresh).andExpect(status().isOk());
  }

  @Test
  void refreshRotatesTheTokenAndRejectsTheOldOne() throws Exception {
    User user = registerUser();
    Cookie original = login(user.getEmail()).getResponse().getCookie("refresh_token");

    MvcResult refreshed = refresh(original).andExpect(status().isOk()).andReturn();
    Cookie rotated = refreshed.getResponse().getCookie("refresh_token");
    Cookie access = refreshed.getResponse().getCookie("access_token");

    assertThat(rotated.getValue()).isNotEqualTo(original.getValue());
    refresh(original).andExpect(status().isUnauthorized());
    refresh(rotated).andExpect(status().isOk());
    mockMvc.perform(get("/users/current").cookie(access)).andExpect(status().isOk());
  }

  @Test
  void logoutEndsOnlyThatDevicesSession() throws Exception {
    User user = registerUser();
    Cookie webRefresh = login(user.getEmail()).getResponse().getCookie("refresh_token");
    Cookie phoneRefresh = login(user.getEmail()).getResponse().getCookie("refresh_token");

    mockMvc.perform(post("/auth/logout").cookie(phoneRefresh)).andExpect(status().isOk());

    refresh(phoneRefresh).andExpect(status().isUnauthorized());
    refresh(webRefresh).andExpect(status().isOk());
  }

  @Test
  void concurrentRefreshesWithTheSameTokenSucceedOnlyOnce() throws Exception {
    User user = registerUser();
    String token = authService.login(user.getEmail(), PASSWORD).refreshToken();
    int attempts = 8;
    CountDownLatch start = new CountDownLatch(1);

    try (ExecutorService executor = Executors.newFixedThreadPool(attempts)) {
      Callable<Boolean> attempt =
          () -> {
            start.await();
            try {
              authService.refresh(token);
              return true;
            } catch (ApplicationException exception) {
              return false;
            }
          };
      List<Future<Boolean>> results =
          IntStream.range(0, attempts).mapToObj(index -> executor.submit(attempt)).toList();
      start.countDown();

      long successes = 0;
      for (Future<Boolean> result : results) {
        if (result.get()) {
          successes++;
        }
      }
      assertThat(successes).isEqualTo(1);
    }
  }

  @Test
  void changingThePasswordEndsEverySession() throws Exception {
    User user = registerUser();
    Cookie refreshCookie = login(user.getEmail()).getResponse().getCookie("refresh_token");

    signIn(user);
    userService.updateProfile(null, "N3w!Password");

    refresh(refreshCookie).andExpect(status().isUnauthorized());
  }

  @Test
  void wrongPasswordAndUnknownEmailGiveTheSameAnswer() throws Exception {
    User user = registerUser();

    loginRequest(user.getEmail(), "Wr0ng!Password").andExpect(status().isUnauthorized());
    loginRequest("nobody-" + UUID.randomUUID() + "@example.com", PASSWORD)
        .andExpect(status().isUnauthorized());
  }

  private MvcResult login(String email, Cookie... cookies) throws Exception {
    return loginRequest(email, PASSWORD, cookies).andExpect(status().isOk()).andReturn();
  }

  private ResultActions loginRequest(String email, String password, Cookie... cookies)
      throws Exception {
    var request =
        post("/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                """
                {"email": "%s", "password": "%s"}
                """
                    .formatted(email, password));
    if (cookies.length > 0) {
      request.cookie(cookies);
    }
    return mockMvc.perform(request);
  }

  private ResultActions refresh(Cookie refreshCookie) throws Exception {
    return mockMvc.perform(post("/auth/refresh").cookie(refreshCookie));
  }
}
