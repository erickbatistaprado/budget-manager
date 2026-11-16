package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.ledger.application.*;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.savings.application.SavingService;
import com.budgetmanager.bm.savings.domain.*;
import com.budgetmanager.bm.support.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class MoneyFlowIntegrationTest extends IntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private AccountService accounts;
  @Autowired private CardService cards;
  @Autowired private TransactionService transactions;
  @Autowired private CategoryService categories;
  @Autowired private SavingService savings;

  @Test
  void movementsCheckpointsSavingsAndOverviewAreOwnedAndPersistent() throws Exception {
    var owner = registerUser();
    signIn(owner);
    var from = accounts.save(null, "Checking", Bank.NUBANK);
    var to = accounts.save(null, "Payment", Bank.BRADESCO);
    var saving =
        savings.save(
            Saving.builder()
                .name("Reserve")
                .amount(BigDecimal.ZERO)
                .location(SavingLocation.SAVINGS_ACCOUNT)
                .build());
    String investment =
        """
        {"kind":"INVESTMENT","date":"2026/01/10","amount":100,"fromAccountId":"%s","savingId":"%s"}
        """
            .formatted(from.getId(), saving.getId());
    String created =
        mvc.perform(
                post("/movements")
                    .with(user(owner.getEmail()))
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(investment))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.automatic").value(false))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String id = JsonPath.read(created, "$.id");
    mvc.perform(get("/savings/{id}/history", saving.getId()).with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.movements[0].amount").value(100));
    mvc.perform(
            post("/savings/{id}/valuations", saving.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"2026/01/11\",\"value\":120}"))
        .andExpect(status().isOk());
    mvc.perform(get("/savings").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].amount").value(120))
        .andExpect(jsonPath("$[0].invested").value(100))
        .andExpect(jsonPath("$[0].gain").value(20));
    mvc.perform(
            post("/movements")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"kind\":\"REDEMPTION\",\"date\":\"2026/01/12\",\"amount\":121,\"savingId\":\"%s\",\"toAccountId\":\"%s\"}"
                        .formatted(saving.getId(), to.getId())))
        .andExpect(status().isBadRequest());
    String checkpoint = "{\"date\":\"2026/01/31\",\"balance\":500,\"preview\":true}";
    mvc.perform(
            post("/accounts/{id}/balance-checkpoints", from.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(checkpoint))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.computed").value(-100))
        .andExpect(jsonPath("$.difference").value(600))
        .andExpect(jsonPath("$.saved").value(false));
    mvc.perform(
            get("/accounts/{id}/balance-checkpoints", from.getId()).with(user(owner.getEmail())))
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(
            post("/accounts/{id}/balance-checkpoints", from.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(checkpoint.replace("true", "false")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.saved").value(true));
    mvc.perform(
            get("/accounts/{id}/balance", from.getId())
                .param("date", "2026/01/31")
                .with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.balance").value(500));
    mvc.perform(delete("/accounts/{id}", from.getId()).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isBadRequest());
    var stranger = registerUser();
    mvc.perform(
            put("/movements/{id}", id)
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(investment))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/movements")
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(investment))
        .andExpect(status().isNotFound());
    mvc.perform(get("/savings/{id}/history", saving.getId()).with(user(stranger.getEmail())))
        .andExpect(status().isNotFound());
    mvc.perform(
            get("/accounts/{id}/balance-checkpoints", from.getId()).with(user(stranger.getEmail())))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/movements/{id}", id).with(user(stranger.getEmail())).with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/movements/{id}", id)
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(investment.replace(":100", ":90")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amount").value(90));
    mvc.perform(delete("/movements/{id}", id).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isNoContent());
  }

  @Test
  void derivedBillPaymentsCanBeRecordedWithoutDuplicatingFundingAndOverviewUsesTheLedger()
      throws Exception {
    var owner = registerUser();
    signIn(owner);
    var checking = accounts.save(null, "Checking", Bank.NUBANK);
    var payment = accounts.save(null, "Payment", Bank.BRADESCO);
    var card = cards.save(null, "Card", 25, 5, Bank.BRADESCO, payment.getId(), checking.getId());
    var expenseCategory = categories.findByTransactionType(TransactionType.EXPENSE).getFirst();
    var incomeCategory = categories.findByTransactionType(TransactionType.INCOME).getFirst();
    transactions.save(
        Transaction.builder()
            .date(LocalDate.of(2026, 1, 1))
            .totalValue(new BigDecimal("1000"))
            .repeats(RepeatInterval.NONE)
            .account(checking)
            .paymentMethod(PaymentMethod.PIX)
            .build(),
        incomeCategory.getId());
    transactions.save(
        Transaction.builder()
            .date(LocalDate.of(2026, 1, 10))
            .totalValue(new BigDecimal("200"))
            .repeats(RepeatInterval.NONE)
            .card(card)
            .paymentMethod(PaymentMethod.CREDIT_CARD)
            .build(),
        expenseCategory.getId());
    transactions.save(
        Transaction.builder()
            .date(LocalDate.of(2026, 1, 11))
            .totalValue(new BigDecimal("20"))
            .repeats(RepeatInterval.NONE)
            .card(card)
            .paymentMethod(PaymentMethod.CREDIT_CARD)
            .build(),
        incomeCategory.getId());
    mvc.perform(
            get("/movements")
                .param("startDate", "2026/02/01")
                .param("endDate", "2026/02/28")
                .with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].automatic").value(true))
        .andExpect(jsonPath("$[0].amount").value(180));
    String body =
        "{\"kind\":\"CARD_BILL_PAYMENT\",\"date\":\"2026/02/04\",\"amount\":175,\"fromAccountId\":\"%s\",\"cardId\":\"%s\",\"billDueDate\":\"2026/02/05\"}"
            .formatted(payment.getId(), card.getId());
    mvc.perform(
            post("/movements")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
    mvc.perform(
            get("/movements")
                .param("startDate", "2026/02/01")
                .param("endDate", "2026/02/28")
                .with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].automatic").value(false))
        .andExpect(jsonPath("$[0].amount").value(175));
    mvc.perform(get("/overview/2026-02").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.expenses").value(200))
        .andExpect(jsonPath("$.incomes").value(20))
        .andExpect(jsonPath("$.surplus").value(-180))
        .andExpect(jsonPath("$.bills[0].total").value(180))
        .andExpect(jsonPath("$.bills[0].automatic").value(false));
    mvc.perform(get("/overview/evolution").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].month").value("2026-01"))
        .andExpect(jsonPath("$[0].accounts").value(1000))
        .andExpect(jsonPath("$[1].accounts").value(825))
        .andExpect(jsonPath("$[1].netWorth").value(825));
    mvc.perform(delete("/cards/{id}", card.getId()).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isBadRequest());
    mvc.perform(delete("/movements/automatic").with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isBadRequest());
  }
}
