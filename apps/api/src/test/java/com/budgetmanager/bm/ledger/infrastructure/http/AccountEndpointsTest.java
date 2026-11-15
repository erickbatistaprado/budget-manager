package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.ledger.application.AccountService;
import com.budgetmanager.bm.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class AccountEndpointsTest extends IntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private AccountService accounts;
  private static final String ACCOUNT = "{\"name\":\"Visa\",\"bank\":\"BRADESCO\"}";

  @Test
  void accountsAreOwnedAndCanBeCreatedUpdatedAndDeleted() throws Exception {
    var owner = registerUser();
    signIn(owner);
    var account = accounts.save(null, "Visa", com.budgetmanager.bm.ledger.domain.Bank.BRADESCO);
    var stranger = registerUser();
    mvc.perform(get("/accounts").with(user(stranger.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(
            put("/accounts/{id}", account.getId())
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(ACCOUNT))
        .andExpect(status().isNotFound());
    mvc.perform(
            delete("/accounts/{id}", account.getId()).with(user(stranger.getEmail())).with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/accounts")
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(ACCOUNT))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Visa"))
        .andExpect(jsonPath("$.bank").value("BRADESCO"));
    mvc.perform(
            put("/accounts/{id}", account.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(ACCOUNT.replace("BRADESCO", "NUBANK")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.bank").value("NUBANK"));
    mvc.perform(delete("/accounts/{id}", account.getId()).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isNoContent());
  }

  @Test
  void rejectsInvalidBanksAndDuplicateNames() throws Exception {
    var owner = registerUser();
    signIn(owner);
    accounts.save(null, "Visa", com.budgetmanager.bm.ledger.domain.Bank.BRADESCO);
    for (String body :
        new String[] {
          ACCOUNT.replace("Visa", " visa "),
          ACCOUNT.replace("BRADESCO", "INVALID"),
          ACCOUNT.replace("\"BRADESCO\"", "null"),
          ACCOUNT.replace("Visa", " ")
        }) {
      mvc.perform(
              post("/accounts")
                  .with(user(owner.getEmail()))
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest());
    }
  }
}
