package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.application.CategoryService;
import com.budgetmanager.bm.ledger.application.TransactionService;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.RepeatInterval;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.support.IntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Goes through HTTP, so the response is rendered after the database session has ended, as in
 * production.
 */
@AutoConfigureMockMvc
class MonthlyEndpointsTest extends IntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private CategoryService categoryService;
  @Autowired private TransactionService transactionService;

  private User owner;
  private Transaction purchase;

  @BeforeEach
  void setUp() {
    owner = registerUser();
    signIn(owner);
    Category category =
        categoryService.save(
            Category.builder().name("Clinic").transactionType(TransactionType.EXPENSE).build());
    purchase =
        transactionService.save(
            Transaction.builder()
                .totalValue(new BigDecimal("300.00"))
                .repeats(RepeatInterval.MONTHLY)
                .date(LocalDate.of(2026, 1, 15))
                .build(),
            category.getId());
  }

  @Test
  void overridesSkipAndRestoreThroughHttp() throws Exception {
    mockMvc
        .perform(
            put("/transactions/{id}/months/2026-12", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":680,\"date\":\"2026/12/01\",\"notes\":\"Discount\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.months[0].amount").value(680))
        .andExpect(jsonPath("$.months[0].month").value("2026-12"));
    mockMvc
        .perform(
            delete("/transactions/{id}/months/2026-12", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf()))
        .andExpect(status().isNoContent());
    mockMvc
        .perform(
            get("/transactions")
                .param("transactionType", "EXPENSE")
                .param("startDate", "2026/12/01")
                .param("endDate", "2026/12/31")
                .with(user(owner.getEmail())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].months[0].skipped").value(true));
    mockMvc
        .perform(
            delete("/transactions/{id}/months/2026-12/override", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf()))
        .andExpect(status().isNoContent());
    assertThat(list(LocalDate.of(2026, 12, 1)).getFirst().getMonths()).isEmpty();
  }

  @Test
  void splitPreservesPastAndDiscardsFutureOverrides() throws Exception {
    transactionService.skipMonth(purchase.getId(), YearMonth.of(2026, 11), false);
    transactionService.skipMonth(purchase.getId(), YearMonth.of(2026, 12), false);
    mockMvc
        .perform(
            post("/transactions/{id}/split/2026-12", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(draft("2026/12/02")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalValue").value(800))
        .andExpect(jsonPath("$.date").value("2026/12/02"));
    Transaction old = list(LocalDate.of(2026, 11, 1)).getFirst();
    assertThat(old.getTotalValue()).isEqualByComparingTo("300");
    assertThat(old.getRepeatUntil()).isEqualTo(LocalDate.of(2026, 11, 1));
    assertThat(old.getMonths()).hasSize(1);
    assertThat(list(LocalDate.of(2026, 12, 1)))
        .hasSize(1)
        .allSatisfy(transaction -> assertThat(transaction.getId()).isNotEqualTo(purchase.getId()));
  }

  @Test
  void firstMonthUpdatesInPlaceAndDeletesTheRow() throws Exception {
    mockMvc
        .perform(
            post("/transactions/{id}/split/2026-01", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(draft("2026/01/02")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(purchase.getId().toString()));
    mockMvc
        .perform(
            delete("/transactions/{id}/from/2026-01", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf()))
        .andExpect(status().isNoContent());
    assertThat(list(LocalDate.of(2026, 1, 1))).isEmpty();
  }

  @Test
  void deleteFromEndsSeriesAndKeepsLastMonthVisibleForPartialRanges() throws Exception {
    mockMvc
        .perform(
            delete("/transactions/{id}/from/2026-12", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf()))
        .andExpect(status().isNoContent());
    assertThat(list(LocalDate.of(2026, 12, 1))).isEmpty();
    assertThat(list(LocalDate.of(2026, 11, 15))).hasSize(1);
  }

  @Test
  void rejectsInvalidMonthsDatesAndWholeSeriesChanges() throws Exception {
    for (String month : new String[] {"2025-12", "2026-13", "bad"}) {
      mockMvc
          .perform(
              delete("/transactions/{id}/months/{month}", purchase.getId(), month)
                  .with(user(owner.getEmail()))
                  .with(csrf()))
          .andExpect(status().isBadRequest());
    }
    mockMvc
        .perform(
            put("/transactions/{id}/months/2026-12", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":680,\"date\":\"2026/11/01\"}"))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(
            delete("/transactions/{id}", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf()))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(
            put("/transactions")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    draft("2026/12/02")
                        .replaceFirst("\\{", "{\"id\":\"" + purchase.getId() + "\",")))
        .andExpect(status().isBadRequest());
  }

  @Test
  void hidesOtherOwnersOnEveryMonthlyRoute() throws Exception {
    User stranger = registerUser();
    String[] routes = {"/months/2026-12", "/months/2026-12/override", "/from/2026-12"};
    for (String route : routes) {
      mockMvc
          .perform(
              delete("/transactions/" + purchase.getId() + route)
                  .with(user(stranger.getEmail()))
                  .with(csrf()))
          .andExpect(status().isNotFound());
    }
    mockMvc
        .perform(
            put("/transactions/{id}/months/2026-12", purchase.getId())
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":1,\"date\":\"2026/12/01\"}"))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            post("/transactions/{id}/split/2026-12", purchase.getId())
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(draft("2026/12/01")))
        .andExpect(status().isNotFound());
  }

  /** MockMvc clears the signed-in user after each request, so sign in again for direct calls. */
  private java.util.List<Transaction> list(LocalDate start) {
    signIn(owner);
    return transactionService
        .findByTransactionTypeAndDateBetween(
            TransactionType.EXPENSE,
            start,
            start.withDayOfMonth(start.lengthOfMonth()),
            "date",
            "asc",
            Pageable.unpaged())
        .getContent();
  }

  private String draft(String date) {
    return "{\"category\":{\"id\":\""
        + purchase.getCategory().getId()
        + "\",\"name\":\"Clinic\",\"transactionType\":\"EXPENSE\"},\"totalValue\":800,\"repeats\":\"MONTHLY\",\"date\":\""
        + date
        + "\"}";
  }
}
