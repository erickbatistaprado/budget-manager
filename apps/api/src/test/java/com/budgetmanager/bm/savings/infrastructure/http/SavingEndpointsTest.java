package com.budgetmanager.bm.savings.infrastructure.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.support.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class SavingEndpointsTest extends IntegrationTest {

  @Autowired private MockMvc mockMvc;

  private User owner;
  private User stranger;

  @BeforeEach
  void setUp() {
    owner = registerUser();
    stranger = registerUser();
  }

  @Test
  void createdEntriesComeBackWithWhenTheyChanged() throws Exception {
    String created = create("  Emergency fund ", "1500.00", "SAVINGS_ACCOUNT");

    assertThat(JsonPath.<String>read(created, "$.name")).isEqualTo("Emergency fund");
    assertThat(JsonPath.<String>read(created, "$.updatedAt")).isNotBlank();
    mockMvc
        .perform(get("/savings").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("Emergency fund"))
        .andExpect(jsonPath("$[0].updatedAt").isNotEmpty());
  }

  @Test
  void updatingMovesUpdatedAtForward() throws Exception {
    String created = create("Broker", "100.00", "INVESTMENT", "STOCKS");
    String id = JsonPath.read(created, "$.id");
    Instant before = Instant.parse(JsonPath.<String>read(created, "$.updatedAt"));
    Thread.sleep(20);

    String updated =
        mockMvc
            .perform(
                put("/savings")
                    .with(user(owner.getEmail()))
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"id": "%s", "name": "Broker", "amount": 250.00, "location": "INVESTMENT",
                         "investmentType": "STOCKS", "updatedAt": "2000-01-01T00:00:00Z"}
                        """
                            .formatted(id)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.amount").value(250.00))
            .andReturn()
            .getResponse()
            .getContentAsString();

    Instant after = Instant.parse(JsonPath.<String>read(updated, "$.updatedAt"));
    assertThat(after).isAfter(before);
  }

  @Test
  void otherUsersCannotSeeChangeOrDeleteMyEntries() throws Exception {
    String id = JsonPath.read(create("Cash box", "80.00", "CASH"), "$.id");

    mockMvc
        .perform(get("/savings").with(user(stranger.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    mockMvc
        .perform(
            put("/savings")
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"id": "%s", "name": "Mine now", "amount": 1, "location": "CASH"}
                    """
                        .formatted(id)))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(delete("/savings/{id}", id).with(user(stranger.getEmail())).with(csrf()))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(delete("/savings/{id}", id).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isNoContent());
  }

  @Test
  void investmentsKeepTheirType() throws Exception {
    String created = create("Index fund", "500.00", "INVESTMENT", "REAL_ESTATE_FUNDS");

    assertThat(JsonPath.<String>read(created, "$.investmentType")).isEqualTo("REAL_ESTATE_FUNDS");
    assertThat(JsonPath.<Object>read(create("Wallet", "20.00", "CASH"), "$.investmentType"))
        .isNull();
  }

  @Test
  void anInvestmentNeedsATypeAndNothingElseMayHaveOne() throws Exception {
    for (String body :
        new String[] {
          """
          {"name": "Broker", "amount": 1, "location": "INVESTMENT"}
          """,
          """
          {"name": "Wallet", "amount": 1, "location": "CASH", "investmentType": "CRYPTO"}
          """
        }) {
      mockMvc
          .perform(
              post("/savings")
                  .with(user(owner.getEmail()))
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.message").exists());
    }
  }

  @Test
  void rejectsNegativeAmountsAndMissingNames() throws Exception {
    mockMvc
        .perform(
            post("/savings")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name": "", "amount": -1, "location": "CASH"}
                    """))
        .andExpect(status().isBadRequest());
  }

  private String create(String name, String amount, String location) throws Exception {
    return create(name, amount, location, null);
  }

  private String create(String name, String amount, String location, String investmentType)
      throws Exception {
    String type = investmentType == null ? "null" : "\"" + investmentType + "\"";
    return mockMvc
        .perform(
            post("/savings")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name": "%s", "amount": %s, "location": "%s", "investmentType": %s}
                    """
                        .formatted(name, amount, location, type)))
        .andExpect(status().isCreated())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }
}
