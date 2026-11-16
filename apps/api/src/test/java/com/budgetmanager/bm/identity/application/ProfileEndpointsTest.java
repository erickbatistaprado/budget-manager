package com.budgetmanager.bm.identity.application;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@AutoConfigureMockMvc
class ProfileEndpointsTest extends IntegrationTest {
  @Autowired private MockMvc mvc;
  @Autowired private AuthService auth;
  @Autowired private JdbcClient jdbc;

  @Test
  void currentPasswordIsRequiredAndOtherRefreshSessionsAreRevoked() throws Exception {
    User owner = registerUser();
    var current = auth.login(owner.getEmail(), PASSWORD);
    var other = auth.login(owner.getEmail(), PASSWORD);
    update(owner, "{\"password\":\"N3w!Password\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Current password is missing or incorrect"));
    update(owner, "{\"password\":\"N3w!Password\",\"currentPassword\":\"wrong\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Current password is missing or incorrect"));
    mvc.perform(
            put("/users")
                .with(user(owner.getEmail()))
                .with(csrf())
                .cookie(new Cookie("refresh_token", current.refreshToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"password\":\"N3w!Password\",\"currentPassword\":\"" + PASSWORD + "\"}"))
        .andExpect(status().isNoContent());
    assertThatThrownBy(() -> auth.refresh(other.refreshToken()))
        .isInstanceOf(com.budgetmanager.bm.shared.application.ApplicationException.class);
    assertThat(auth.refresh(current.refreshToken())).isNotNull();
    assertThat(auth.login(owner.getEmail(), "N3w!Password")).isNotNull();
    update(owner, "{\"name\":\"New name\"}").andExpect(status().isNoContent());
    mvc.perform(get("/users/current").with(user(owner.getEmail())))
        .andExpect(jsonPath("$.name").value("New name"));
  }

  @Test
  void salaryDayIsNullableAndValidated() throws Exception {
    User owner = registerUser();
    for (String value : new String[] {"0", "32", "-1"}) {
      preferences(owner, value).andExpect(status().isBadRequest());
    }
    for (String value : new String[] {"1", "31", "null"}) {
      preferences(owner, value).andExpect(status().isNoContent());
      var result =
          mvc.perform(get("/users/current").with(user(owner.getEmail())))
              .andExpect(status().isOk());
      if ("null".equals(value)) {
        result.andExpect(jsonPath("$.salaryDay").isEmpty());
      } else {
        result.andExpect(jsonPath("$.salaryDay").value(Integer.parseInt(value)));
      }
    }
  }

  @Test
  void databaseAlsoEnforcesSalaryDayRange() {
    User owner = registerUser();
    assertThatThrownBy(() ->
            jdbc.sql("UPDATE t_user SET salary_day = 32 WHERE id = :owner")
                .param("owner", owner.getId())
                .update())
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
  }

  @Test
  void exportIncludesOnlyOwnedRecordsAndNeverSecretsAndIsNotCached() throws Exception {
    User owner = registerUser();
    User stranger = registerUser();
    seed(owner, "owned");
    seed(stranger, "foreign");
    mvc.perform(get("/users/current/data-summary").with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.entryCount").value(1))
        .andExpect(jsonPath("$.firstEntryDate").value("2026-01-01"));
    var response =
        mvc.perform(get("/users/current/export").with(user(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(
                header()
                    .string(
                        "Content-Disposition",
                        org.hamcrest.Matchers.matchesPattern(
                            "attachment; filename=\"budget-manager-backup-\\d{4}-\\d{2}-\\d{2}\\.json\"")))
            .andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.exportedAt").isNotEmpty())
            .andExpect(jsonPath("$.sections.profile[0].email").value(owner.getEmail()))
            .andExpect(jsonPath("$.sections.profile[0].password").doesNotExist())
            .andExpect(jsonPath("$.sections.transactions.length()").value(1))
            .andExpect(jsonPath("$.sections.installments.length()").value(1))
            .andExpect(jsonPath("$.sections.monthlyOverrides.length()").value(1))
            .andExpect(jsonPath("$.sections.financings.length()").value(1))
            .andExpect(jsonPath("$.sections.financingChanges.length()").value(1))
            .andExpect(jsonPath("$.sections.cards.length()").value(1))
            .andExpect(jsonPath("$.sections.accounts.length()").value(1))
            .andExpect(jsonPath("$.sections.savings.length()").value(1))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(response)
        .doesNotContain(
            "foreign", stranger.getId().toString(), "password", "token", "profile_image");
    mvc.perform(get("/users/current/export")).andExpect(status().isUnauthorized());
  }

  private void seed(User owner, String name) {
    UUID category = UUID.randomUUID();
    UUID transaction = UUID.randomUUID();
    UUID financing = UUID.randomUUID();
    jdbc.sql(
            "INSERT INTO t_category(id,user_id,name,transaction_type) VALUES (:id,:owner,:name,'EXPENSE')")
        .param("id", category)
        .param("owner", owner.getId())
        .param("name", name)
        .update();
    jdbc.sql(
            "INSERT INTO t_transaction(id,user_id,category_id,date,total_value,repeats,notes) VALUES (:id,:owner,:category,'2026-01-01',10,'NONE',:name)")
        .param("id", transaction)
        .param("owner", owner.getId())
        .param("category", category)
        .param("name", name)
        .update();
    jdbc.sql(
            "INSERT INTO t_installment(id,transaction_id,amount,due_date,installment_number,total_installments) VALUES (:id,:parent,5,'2026-01-01',1,2)")
        .param("id", UUID.randomUUID())
        .param("parent", transaction)
        .update();
    jdbc.sql(
            "INSERT INTO t_transaction_month(id,transaction_id,month,amount) VALUES (:id,:parent,'2026-02-01',20)")
        .param("id", UUID.randomUUID())
        .param("parent", transaction)
        .update();
    jdbc.sql(
            "INSERT INTO t_card(id,user_id,name,bank,closing_day,due_day) VALUES (:id,:owner,:name,'OTHER',1,5)")
        .param("id", UUID.randomUUID())
        .param("owner", owner.getId())
        .param("name", name)
        .update();
    jdbc.sql("INSERT INTO t_account(id,user_id,name,bank) VALUES (:id,:owner,:name,'OTHER')")
        .param("id", UUID.randomUUID())
        .param("owner", owner.getId())
        .param("name", name)
        .update();
    jdbc.sql(
            "INSERT INTO t_saving(id,user_id,name,amount,location) VALUES (:id,:owner,:name,10,'CASH')")
        .param("id", UUID.randomUUID())
        .param("owner", owner.getId())
        .param("name", name)
        .update();
    jdbc.sql(
            "INSERT INTO t_financing(id,user_id,name,kind,category_id,system,amount,rate,rate_period,term,first_due_date,insurance,fees) VALUES (:id,:owner,:name,'OTHER',:category,'PRICE',100,0.01,'MONTHLY',12,'2026-01-01',0,0)")
        .param("id", financing)
        .param("owner", owner.getId())
        .param("name", name)
        .param("category", category)
        .update();
    jdbc.sql(
            "INSERT INTO t_financing_change(id,financing_id,sequence,type,amount) VALUES (:id,:parent,1,'EXTRA_PAYMENT',10)")
        .param("id", UUID.randomUUID())
        .param("parent", financing)
        .update();
  }

  private ResultActions update(User owner, String body) throws Exception {
    return mvc.perform(
        put("/users")
            .with(user(owner.getEmail()))
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private ResultActions preferences(User owner, String value) throws Exception {
    return mvc.perform(
        put("/users/current/preferences")
            .with(user(owner.getEmail()))
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"salaryDay\":" + value + "}"));
  }
}
