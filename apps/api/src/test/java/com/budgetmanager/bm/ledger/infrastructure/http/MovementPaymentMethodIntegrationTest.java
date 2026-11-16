package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.ledger.application.AccountService;
import com.budgetmanager.bm.ledger.application.CardService;
import com.budgetmanager.bm.ledger.domain.Bank;
import com.budgetmanager.bm.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class MovementPaymentMethodIntegrationTest extends IntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private AccountService accounts;
  @Autowired private CardService cards;

  @Test
  void persistsPaymentMethodsAndRejectsInvalidTransfersAndCardMethods() throws Exception {
    var owner = registerUser();
    signIn(owner);
    var from = accounts.save(null, "From", Bank.NUBANK);
    var to = accounts.save(null, "To", Bank.BRADESCO);
    var card = cards.save(null, "Visa", 25, 5);
    String transfer =
        """
        {"kind":"TRANSFER","date":"2026/12/05","amount":30,"fromAccountId":"%s","toAccountId":"%s","paymentMethod":"PIX"}
        """
            .formatted(from.getId(), to.getId());
    mvc.perform(
            post("/movements")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(transfer))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.paymentMethod").value("PIX"));
    mvc.perform(
            get("/movements")
                .param("startDate", "2026/12/01")
                .param("endDate", "2026/12/31")
                .with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].paymentMethod").value("PIX"));
    mvc.perform(
            post("/movements")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(transfer.replace("PIX", "AUTOMATIC_DEBIT")))
        .andExpect(status().isBadRequest());
    String payment =
        """
        {"kind":"CARD_BILL_PAYMENT","date":"2026/12/05","amount":30,"fromAccountId":"%s","cardId":"%s","billDueDate":"2026/12/05","paymentMethod":"AUTOMATIC_DEBIT"}
        """
            .formatted(from.getId(), card.getId());
    mvc.perform(
            post("/movements")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payment.replace("AUTOMATIC_DEBIT", "CREDIT_CARD")))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/movements")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payment))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.paymentMethod").value("AUTOMATIC_DEBIT"));
  }
}
