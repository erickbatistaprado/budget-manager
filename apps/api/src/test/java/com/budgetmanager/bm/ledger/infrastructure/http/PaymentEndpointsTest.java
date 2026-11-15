package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.ledger.application.AccountService;
import com.budgetmanager.bm.ledger.application.CardService;
import com.budgetmanager.bm.ledger.application.CategoryService;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.support.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class PaymentEndpointsTest extends IntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private AccountService accounts;
  @Autowired private CardService cards;
  @Autowired private CategoryService categories;

  @Test
  void savesEachMethodAndReturnsTheOwnedAccount() throws Exception {
    var owner = registerUser();
    signIn(owner);
    var account = accounts.save(null, "Nubank checking", Bank.NUBANK);
    var card = cards.save(null, "Bradesco", 25, 5, Bank.BRADESCO);
    UUID categoryId = categories.findByTransactionType(TransactionType.EXPENSE).getFirst().getId();
    for (PaymentMethod method : PaymentMethod.values()) {
      UUID cardId = method == PaymentMethod.CREDIT_CARD ? card.getId() : null;
      UUID accountId = null;
      if (method != PaymentMethod.CREDIT_CARD
          && method != PaymentMethod.CASH
          && method != PaymentMethod.OTHER) {
        accountId = account.getId();
      }
      var response =
          mvc.perform(
                  post("/transactions")
                      .with(user(owner.getEmail()))
                      .with(csrf())
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(body(categoryId, method, cardId, accountId, "NONE")))
              .andExpect(status().isCreated())
              .andExpect(jsonPath("$.paymentMethod").value(method.name()));
      if (accountId != null) {
        response
            .andExpect(jsonPath("$.account.id").value(accountId.toString()))
            .andExpect(jsonPath("$.account.name").value("Nubank checking"))
            .andExpect(jsonPath("$.account.bank").value("NUBANK"));
      }
    }
    mvc.perform(
            post("/transactions")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(categoryId, PaymentMethod.BOLETO, null, account.getId(), "MONTHLY")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.account.bank").value("NUBANK"));
    mvc.perform(
            get("/transactions")
                .with(user(owner.getEmail()))
                .param("transactionType", "EXPENSE")
                .param("startDate", "2026/11/01")
                .param("endDate", "2027/01/31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(9));
  }

  @Test
  void rejectsInvalidCombinationsAndHidesAnotherOwnersAccount() throws Exception {
    var owner = registerUser();
    signIn(owner);
    var account = accounts.save(null, "Nubank", Bank.NUBANK);
    UUID categoryId = categories.findByTransactionType(TransactionType.EXPENSE).getFirst().getId();
    for (String invalid :
        new String[] {
          body(categoryId, PaymentMethod.CREDIT_CARD, null, null, "NONE"),
          body(categoryId, PaymentMethod.CASH, null, account.getId(), "NONE"),
          body(categoryId, null, null, account.getId(), "NONE")
        }) {
      mvc.perform(
              post("/transactions")
                  .with(user(owner.getEmail()))
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(invalid))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.message").isNotEmpty());
    }
    var stranger = registerUser();
    signIn(stranger);
    UUID strangerCategory =
        categories.findByTransactionType(TransactionType.EXPENSE).getFirst().getId();
    mvc.perform(
            post("/transactions")
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(strangerCategory, PaymentMethod.PIX, null, account.getId(), "NONE")))
        .andExpect(status().isNotFound());
  }

  private String body(
      UUID categoryId, PaymentMethod method, UUID cardId, UUID accountId, String repeats) {
    return """
    {"category":{"id":"%s","name":"Food","transactionType":"EXPENSE"},"totalValue":10,"date":"2026/11/01","repeats":"%s","paymentMethod":%s,"cardId":%s,"accountId":%s}
    """
        .formatted(categoryId, repeats, quoted(method), quoted(cardId), quoted(accountId));
  }

  private String quoted(Object value) {
    return value == null ? "null" : "\"" + value + "\"";
  }
}
