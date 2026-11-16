package com.budgetmanager.bm.goals.infrastructure.http;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.application.AccountService;
import com.budgetmanager.bm.ledger.domain.Bank;
import com.budgetmanager.bm.savings.application.SavingService;
import com.budgetmanager.bm.savings.domain.*;
import com.budgetmanager.bm.support.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@AutoConfigureMockMvc
class GoalsIntegrationTest extends IntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private AccountService accounts;
  @Autowired private SavingService savings;

  @Test
  void crudRankingAllocationsPlanAndExportAreOwned() throws Exception {
    User owner = registerUser();
    User stranger = registerUser();
    String first = create(owner, "First", null);
    String second = create(owner, "Second", null);
    write(owner, "/goals/" + second + "/position", "{\"position\":1}", true)
        .andExpect(status().isNoContent());
    mvc.perform(get("/goals").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(second))
        .andExpect(jsonPath("$[1].position").value(2));
    write(owner, "/goals/" + first, "{\"name\":\"Updated\",\"price\":250,\"kind\":\"NEED\"}", true)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Updated"));
    String allocation = "{\"date\":\"2026/01/01\",\"amount\":50}";
    write(owner, "/goals/" + first + "/allocations", allocation, false)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.movementId").isEmpty());
    mvc.perform(get("/goals/plan").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.reserved").value(50))
        .andExpect(jsonPath("$.goals[1].saved").value(50));
    write(owner, "/goals/pace", "{\"monthlyAmount\":100}", true).andExpect(status().isNoContent());
    mvc.perform(get("/goals/plan").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.pace").value(100))
        .andExpect(jsonPath("$.goals[0].expectedMonth").isNotEmpty());
    write(owner, "/goals/pace", "{\"monthlyAmount\":null}", true).andExpect(status().isNoContent());
    mvc.perform(get("/goals/plan").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.paceOverride").isEmpty());
    mvc.perform(get("/users/current/export").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sections.goals.length()").value(2))
        .andExpect(jsonPath("$.sections.goalAllocations.length()").value(1));
    write(stranger, "/goals/" + first + "/allocations", allocation, false)
        .andExpect(status().isNotFound());
    mvc.perform(get("/goals/" + first + "/allocations").with(user(stranger.getEmail())))
        .andExpect(status().isNotFound());
    write(
            stranger,
            "/goals/" + first,
            "{\"name\":\"Foreign\",\"price\":10,\"kind\":\"WANT\"}",
            true)
        .andExpect(status().isNotFound());
    write(stranger, "/goals/" + first + "/position", "{\"position\":1}", true)
        .andExpect(status().isNotFound());
    mvc.perform(delete("/goals/" + first).with(user(stranger.getEmail())).with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(get("/goals").with(user(stranger.getEmail())))
        .andExpect(jsonPath("$.length()").value(0));
    write(
            owner,
            "/goals/" + first + "/allocations",
            "{\"date\":\"2026/01/02\",\"amount\":-51}",
            false)
        .andExpect(status().isBadRequest());
    write(
            owner,
            "/goals/" + first + "/allocations",
            "{\"date\":\"2026/01/02\",\"amount\":-50}",
            false)
        .andExpect(status().isOk());
    mvc.perform(delete("/goals/" + second).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/goals").with(user(owner.getEmail())))
        .andExpect(jsonPath("$[0].position").value(1));
  }

  @Test
  void linkedAllocationCreatesLedgerInvestmentAndMainAccountIsOwnedAndClearedOnDelete()
      throws Exception {
    User owner = registerUser();
    signIn(owner);
    var account = accounts.save(null, "Checking", Bank.OTHER);
    var disposable = accounts.save(null, "Disposable", Bank.OTHER);
    var saving =
        savings.save(
            Saving.builder()
                .name("Trip")
                .amount(BigDecimal.ZERO)
                .location(SavingLocation.SAVINGS_ACCOUNT)
                .build());
    String goal = create(owner, "Trip", saving.getId().toString());
    String date = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
    write(
            owner,
            "/goals/" + goal + "/allocations",
            "{\"date\":\"%s\",\"amount\":75,\"fromAccountId\":\"%s\"}"
                .formatted(date, account.getId()),
            false)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.movementId").isNotEmpty());
    mvc.perform(get("/savings").with(user(owner.getEmail())))
        .andExpect(jsonPath("$[0].amount").value(75));
    mvc.perform(get("/accounts").with(user(owner.getEmail())))
        .andExpect(
            jsonPath("$[?(@.name == 'Checking')].balance", org.hamcrest.Matchers.contains(-75.0)));
    mvc.perform(get("/savings/" + saving.getId() + "/history").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.movements[0].kind").value("INVESTMENT"));
    write(
            owner,
            "/goals/" + goal + "/allocations",
            "{\"date\":\"%s\",\"amount\":-75}".formatted(date),
            false)
        .andExpect(status().isOk());
    mvc.perform(get("/savings").with(user(owner.getEmail())))
        .andExpect(jsonPath("$[0].amount").value(75));
    write(
            owner,
            "/users/current/preferences",
            "{\"salaryDay\":15,\"mainAccountId\":\"%s\"}".formatted(disposable.getId()),
            true)
        .andExpect(status().isNoContent());
    mvc.perform(get("/users/current").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.mainAccountId").value(disposable.getId().toString()));
    User stranger = registerUser();
    write(
            stranger,
            "/users/current/preferences",
            "{\"mainAccountId\":\"%s\"}".formatted(disposable.getId()),
            true)
        .andExpect(status().isNotFound());
    mvc.perform(delete("/accounts/" + disposable.getId()).with(user(owner.getEmail())).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/users/current").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.mainAccountId").isEmpty());
  }

  @Autowired private com.budgetmanager.bm.ledger.application.CategoryService categories;
  @Autowired private com.budgetmanager.bm.ledger.application.TransactionService transactions;
  @Autowired private com.budgetmanager.bm.ledger.infrastructure.persistence.CardRepository cards;

  @Test
  void splitPreviewConfirmationPurchaseBalancesAndOwnership() throws Exception {
    User owner = registerUser();
    signIn(owner);
    var account = accounts.save(null, "Checking", Bank.OTHER);
    var category =
        categories
            .findByTransactionType(com.budgetmanager.bm.ledger.domain.TransactionType.INCOME)
            .getFirst();
    LocalDate today = LocalDate.now();
    String date = today.format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
    transactions.save(
        com.budgetmanager.bm.ledger.domain.Transaction.builder()
            .date(today)
            .totalValue(new BigDecimal("1000"))
            .paymentMethod(com.budgetmanager.bm.ledger.domain.PaymentMethod.PIX)
            .account(account)
            .build(),
        category.getId());
    var saving =
        savings.save(
            Saving.builder()
                .name("Goal saving")
                .amount(BigDecimal.ZERO)
                .location(SavingLocation.SAVINGS_ACCOUNT)
                .build());
    String first = create(owner, "Keyboard", saving.getId().toString());
    String second = create(owner, "Trip", null);
    String split =
        """
        {"date":"%s","amount":500,"fromAccountId":"%s","preview":%s}
        """;
    write(owner, "/goals/allocate", split.formatted(date, account.getId(), true), false)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.investmentAmount").value(100))
        .andExpect(jsonPath("$.saved").value(false));
    mvc.perform(get("/goals/" + first + "/allocations").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.length()").value(0));
    write(owner, "/goals/allocate", split.formatted(date, account.getId(), false), false)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.saved").value(true));
    mvc.perform(get("/savings").with(user(owner.getEmail())))
        .andExpect(jsonPath("$[0].amount").value(200));
    write(
            owner,
            "/goals/allocate",
            split.formatted(date, account.getId(), false).replace("500", "601"),
            false)
        .andExpect(status().isBadRequest());
    signIn(owner);
    var expense =
        categories
            .findByTransactionType(com.budgetmanager.bm.ledger.domain.TransactionType.EXPENSE)
            .getFirst();
    String purchase =
        """
        {"price":150,"date":"%s","categoryId":"%s","paymentMethod":"PIX","accountId":"%s"}
        """
            .formatted(date, expense.getId(), account.getId());
    User stranger = registerUser();
    write(stranger, "/goals/" + first + "/purchase", purchase, false)
        .andExpect(status().isNotFound());
    write(stranger, "/goals/allocate", split.formatted(date, account.getId(), true), false)
        .andExpect(status().isNotFound());
    write(stranger, "/categories/" + expense.getId() + "/fixed-cost", "{\"fixedCost\":true}", true)
        .andExpect(status().isNotFound());
    write(owner, "/goals/" + first + "/purchase", purchase, false)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ACHIEVED"))
        .andExpect(jsonPath("$.actualPrice").value(150))
        .andExpect(jsonPath("$.savedAtPurchase").value(200))
        .andExpect(jsonPath("$.expenseTransactionId").isNotEmpty());
    mvc.perform(get("/savings").with(user(owner.getEmail())))
        .andExpect(jsonPath("$[0].amount").value(0));
    mvc.perform(get("/overview/" + java.time.YearMonth.from(today)).with(user(owner.getEmail())))
        .andExpect(jsonPath("$.expenses").value(150))
        .andExpect(jsonPath("$.accounts[0].balance").value(850));
    mvc.perform(get("/goals/plan").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.goals.length()").value(1))
        .andExpect(jsonPath("$.reserved").value(200));
    mvc.perform(get("/goals/" + first + "/allocations").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.length()").value(2));
    write(owner, "/goals/" + first + "/purchase", purchase, false)
        .andExpect(status().isBadRequest());
    mvc.perform(get("/goals").with(user(owner.getEmail())))
        .andExpect(
            jsonPath("$[?(@.id=='" + second + "')].position")
                .value(org.hamcrest.Matchers.contains(1)));
    mvc.perform(get("/users/current/export").with(user(owner.getEmail())))
        .andExpect(
            jsonPath("$.sections.goals[?(@.id=='" + first + "')].actual_price")
                .value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.any(Number.class))));
  }

  @Test
  void cardPurchaseRedeemsToMainAccountAndCreatesInstallments() throws Exception {
    User owner = registerUser();
    signIn(owner);
    var main = accounts.save(null, "Main", Bank.OTHER);
    var card =
        cards.save(
            com.budgetmanager.bm.ledger.domain.Card.builder()
                .user(owner)
                .name("Card")
                .closingDay(10)
                .dueDay(20)
                .build());
    var category =
        categories
            .findByTransactionType(com.budgetmanager.bm.ledger.domain.TransactionType.EXPENSE)
            .getFirst();
    var saving =
        savings.save(
            Saving.builder()
                .name("Card saving")
                .amount(BigDecimal.ZERO)
                .location(SavingLocation.SAVINGS_ACCOUNT)
                .build());
    String goal = create(owner, "Keyboard", saving.getId().toString());
    String date = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
    write(
            owner,
            "/users/current/preferences",
            "{\"mainAccountId\":\"%s\"}".formatted(main.getId()),
            true)
        .andExpect(status().isNoContent());
    write(
            owner,
            "/goals/" + goal + "/allocations",
            "{\"date\":\"%s\",\"amount\":200,\"fromAccountId\":\"%s\"}"
                .formatted(date, main.getId()),
            false)
        .andExpect(status().isOk());
    write(
            owner,
            "/goals/" + goal + "/purchase",
            """
            {"date":"%s","price":300,"categoryId":"%s","paymentMethod":"CREDIT_CARD","cardId":"%s","installments":3}
            """
                .formatted(date, category.getId(), card.getId()),
            false)
        .andExpect(status().isOk());
    mvc.perform(
            get("/movements")
                .param("startDate", date)
                .param("endDate", date)
                .with(user(owner.getEmail())))
        .andExpect(
            jsonPath("$[?(@.kind=='REDEMPTION')].toAccountId")
                .value(org.hamcrest.Matchers.contains(main.getId().toString())));
    signIn(owner);
    var data =
        transactions.findByTransactionTypeAndDateBetween(
            com.budgetmanager.bm.ledger.domain.TransactionType.EXPENSE,
            LocalDate.now(),
            LocalDate.now().plusMonths(5),
            "date",
            "asc",
            org.springframework.data.domain.Pageable.unpaged());
    org.assertj.core.api.Assertions.assertThat(data.getContent().getFirst().getInstallments())
        .hasSize(3);
  }

  @Test
  void tipsUseOwnedExpensesAndFixedSettingAndRejectInvalidMonth() throws Exception {
    User owner = registerUser();
    signIn(owner);
    var category =
        categories.save(
            com.budgetmanager.bm.ledger.domain.Category.builder()
                .name("Delivery tips")
                .transactionType(com.budgetmanager.bm.ledger.domain.TransactionType.EXPENSE)
                .build());
    var month = java.time.YearMonth.now().minusMonths(1);
    for (int offset = 0; offset <= 6; offset++) {
      transactions.save(
          com.budgetmanager.bm.ledger.domain.Transaction.builder()
              .date(month.minusMonths(offset).atDay(1))
              .totalValue(new BigDecimal(offset == 0 ? "900" : "600"))
              .build(),
          category.getId());
    }
    mvc.perform(
            get("/goals/savings-tips")
                .param("month", month.toString())
                .with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].category").value("Delivery tips"))
        .andExpect(jsonPath("$[0].difference").value(300))
        .andExpect(jsonPath("$[0].percentAbove").value(50));
    write(owner, "/categories/" + category.getId() + "/fixed-cost", "{\"fixedCost\":true}", true)
        .andExpect(status().isOk());
    mvc.perform(get("/goals/savings-tips").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(get("/goals/savings-tips").param("month", "2026-13").with(user(owner.getEmail())))
        .andExpect(status().isBadRequest());
    User stranger = registerUser();
    mvc.perform(get("/goals/savings-tips").with(user(stranger.getEmail())))
        .andExpect(jsonPath("$.length()").value(0));
  }

  private String create(User owner, String name, String savingId) throws Exception {
    String body =
        "{\"name\":\"%s\",\"price\":200,\"kind\":\"WANT\",\"savingId\":%s}"
            .formatted(name, savingId == null ? "null" : "\"" + savingId + "\"");
    String response =
        write(owner, "/goals", body, false)
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JsonPath.read(response, "$.id");
  }

  private ResultActions write(User owner, String path, String body, boolean update)
      throws Exception {
    var request = update ? put(path) : post(path);
    return mvc.perform(
        request
            .with(user(owner.getEmail()))
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }
}
