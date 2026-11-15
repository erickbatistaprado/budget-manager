package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.budgetmanager.bm.identity.domain.User;
import com.budgetmanager.bm.ledger.application.CategoryService;
import com.budgetmanager.bm.ledger.application.TransactionService;
import com.budgetmanager.bm.ledger.domain.Category;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.support.IntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Goes through HTTP, so the response is rendered after the database session has ended, as in
 * production.
 */
@AutoConfigureMockMvc
class InstallmentEndpointsTest extends IntegrationTest {

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
                .installmentNumbers(3)
                .date(LocalDate.of(2026, 1, 15))
                .build(),
            category.getId());
  }

  @Test
  void paysInstallmentsEarlyAndReturnsTheTransaction() throws Exception {
    mockMvc
        .perform(
            post("/transactions/{id}/installments/pay-early", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"installmentNumbers": [3], "paidOn": "2026/01/20"}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.category.name").value("Clinic"))
        .andExpect(jsonPath("$.installments[2].installmentNumber").value(3))
        .andExpect(jsonPath("$.installments[2].paidEarly").value(true))
        .andExpect(jsonPath("$.installments[2].dueDate").value("2026/01/20"));
  }

  @Test
  void restoresInstallmentsAndReturnsTheTransaction() throws Exception {
    transactionService.payInstallmentsEarly(
        purchase.getId(), List.of(3), LocalDate.of(2026, 1, 20));

    mockMvc
        .perform(
            post("/transactions/{id}/installments/restore", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"installmentNumbers": [3]}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.installments[2].paidEarly").value(false))
        .andExpect(jsonPath("$.installments[2].dueDate").value("2026/03/15"));
  }

  @Test
  void explainsWhyAPaymentIsNotEarly() throws Exception {
    mockMvc
        .perform(
            post("/transactions/{id}/installments/pay-early", purchase.getId())
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"installmentNumbers": [2], "paidOn": "2026/05/01"}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").exists());
  }
}
