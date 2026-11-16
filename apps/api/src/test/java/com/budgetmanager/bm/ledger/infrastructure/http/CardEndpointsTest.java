package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.ledger.application.CardService;
import com.budgetmanager.bm.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class CardEndpointsTest extends IntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private CardService cards;
  private static final String CARD =
      "{\"bank\":\"BRADESCO\",\"name\":\"Visa\",\"closingDay\":25,\"dueDay\":5}";

  @Test
  void acceptsOptionalLimitAndRejectsInvalidMoney() throws Exception {
    var owner = registerUser();
    mvc.perform(
            post("/cards")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(CARD.replace("}", ",\"creditLimit\":50000}")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.creditLimit").value(50000))
        .andExpect(jsonPath("$.usedLimit").value(0))
        .andExpect(jsonPath("$.availableLimit").value(50000));
    for (String limit : new String[] {"0", "-1", "1.001", "100000000000000000"}) {
      mvc.perform(
              post("/cards")
                  .with(user(owner.getEmail()))
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(CARD.replace("}", ",\"creditLimit\":" + limit + "}")))
          .andExpect(status().isBadRequest());
    }
  }

  @Test
  void cardsAreOwnedAndCanBeCreatedUpdatedAndDeleted() throws Exception {
    var owner = registerUser();
    signIn(owner);
    var card = cards.save(null, "Visa", 25, 5);
    var stranger = registerUser();
    mvc.perform(get("/cards").with(user(stranger.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(
            put("/cards/{id}", card.getId())
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(CARD))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/cards/{id}", card.getId()).with(user(stranger.getEmail())).with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/cards")
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(CARD))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Visa"))
        .andExpect(jsonPath("$.bank").value("BRADESCO"));
    mvc.perform(
            put("/cards/{id}", card.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(CARD.replace("25", "24")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.closingDay").value(24));
    mvc.perform(delete("/cards/{id}", card.getId()).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isNoContent());
  }

  @Test
  void rejectsInvalidDaysAndDuplicateNames() throws Exception {
    var owner = registerUser();
    signIn(owner);
    cards.save(null, "Visa", 25, 5);
    for (String body :
        new String[] {
          CARD.replace("Visa", " visa "),
          CARD.replace("25", "0"),
          CARD.replace("25", "32"),
          CARD.replace("Visa", " ")
        }) {
      mvc.perform(
              post("/cards")
                  .with(user(owner.getEmail()))
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest());
    }
  }
}
