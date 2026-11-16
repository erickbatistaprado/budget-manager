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
