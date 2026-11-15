package com.budgetmanager.bm.financing.infrastructure.http;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.budgetmanager.bm.financing.application.FinancingService;
import com.budgetmanager.bm.financing.domain.Amortization;
import com.budgetmanager.bm.ledger.application.CategoryService;
import com.budgetmanager.bm.ledger.application.TransactionService;
import com.budgetmanager.bm.ledger.domain.PaymentMethod;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.ledger.infrastructure.persistence.TransactionRepository;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.budgetmanager.bm.support.IntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

@AutoConfigureMockMvc
class FinancingIntegrationTest extends IntegrationTest {
  @Autowired private FinancingService financings;
  @Autowired private CategoryService categories;
  @Autowired private TransactionService transactions;
  @Autowired private TransactionRepository repository;
  @Autowired private TransactionTemplate template;
  @Autowired private MockMvc mvc;

  @Test
  void mirrorsExplicitAmountsDatesAndPaymentsAndRejectsLedgerChanges() {
    signIn(registerUser());
    var category = categories.findByTransactionType(TransactionType.EXPENSE).getFirst();
    var terms =
        new Amortization.Terms(
            Amortization.System.SAC,
            new BigDecimal("50000"),
            new BigDecimal("0.015"),
            36,
            LocalDate.of(2026, 1, 28),
            null,
            BigDecimal.TEN,
            BigDecimal.ONE);
    var saved =
        financings.save(
            null,
            new FinancingService.Draft(
                "Car",
                "VEHICLE",
                "Bank",
                null,
                null,
                null,
                null,
                null,
                category.getId(),
                PaymentMethod.BOLETO,
                null,
                2,
                terms));
    assertThat(financings.get(saved.getId()).schedule()).isEqualTo(saved.schedule());
    assertThat(saved.schedule().getFirst().paidAmount()).isEqualByComparingTo("2149.89");
    var listed =
        transactions
            .findByTransactionTypeAndDateBetween(
                TransactionType.EXPENSE,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 1, 31),
                "date",
                "asc",
                PageRequest.of(0, 100))
            .getContent();
    var managed =
        listed.stream()
            .filter(transaction -> saved.getId().equals(transaction.getFinancingId()))
            .findFirst()
            .orElseThrow();
    assertThat(managed.getSource()).isEqualTo("FINANCING");
    assertThat(managed.getPaymentMethod()).isEqualTo(PaymentMethod.BOLETO);
    assertThat(managed.getInstallments()).hasSize(36);
    assertThat(
            managed.getInstallments().stream()
                .map(installment -> installment.getAmount())
                .distinct()
                .count())
        .isGreaterThan(1);
    assertThatThrownBy(() -> transactions.deleteById(managed.getId()))
        .isInstanceOf(ApplicationException.class)
        .hasMessageContaining("financing");
    assertThatThrownBy(() -> transactions.update(managed, category.getId()))
        .isInstanceOf(ApplicationException.class);
    assertThatThrownBy(() ->
            transactions.payInstallmentsEarly(
                managed.getId(), List.of(3), LocalDate.of(2026, 1, 1)))
        .isInstanceOf(ApplicationException.class);
    assertThatThrownBy(() ->
            transactions.changeMonth(
                managed.getId(),
                YearMonth.of(2026, 3),
                BigDecimal.TEN,
                LocalDate.of(2026, 3, 1),
                null))
        .isInstanceOf(ApplicationException.class);
    template.executeWithoutResult(status ->
        assertThat(repository.findImportCandidates(saved.getUserId()))
            .noneMatch(candidate -> candidate.id().equals(managed.getId())));
    var adjusted = financings.dueDay(saved.getId(), 11, 7);
    var reloaded = financings.get(saved.getId());
    assertThat(reloaded.getChanges()).isEqualTo(adjusted.getChanges());
    assertThat(reloaded.schedule()).isEqualTo(adjusted.schedule());
    template.executeWithoutResult(status -> {
      var transaction = repository.findById(managed.getId()).orElseThrow();
      assertThat(
              transaction.getInstallments().stream()
                  .filter(installment -> installment.getInstallmentNumber() == 11)
                  .findFirst()
                  .orElseThrow()
                  .getDueDate())
          .isEqualTo(LocalDate.of(2026, 12, 7));
    });
    signIn(registerUser());
    assertThatThrownBy(() -> financings.get(saved.getId()))
        .isInstanceOf(ApplicationException.class)
        .hasMessageContaining("not found");
  }

  @Test
  void previewDoesNotPersistAndRequestsOmitResponseOnlyFieldsAndOtherOwnersGet404()
      throws Exception {
    var owner = registerUser();
    signIn(owner);
    var category = categories.findByTransactionType(TransactionType.EXPENSE).getFirst();
    String body =
        """
        {"name":"House","kind":"REAL_ESTATE","system":"PRICE","amount":50000,"monthlyRate":0.015,"term":36,"firstDueDate":"2026/01/28","alreadyPaid":2,"paymentMethod":"BOLETO","categoryId":"%s"}
        """
            .formatted(category.getId());
    mvc.perform(
            post("/financings/preview")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.schedule[0].payment").value(1807.62))
        .andExpect(jsonPath("$.schedule[0].dueDate").value("2026/01/28"));
    signIn(owner);
    assertThat(financings.list()).isEmpty();
    mvc.perform(
            post("/financings")
                .with(user(owner.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.calculation.schedule[0].paidAmount").value(1807.62));
    signIn(owner);
    var saved = financings.list().getFirst();
    var stranger = registerUser();
    mvc.perform(get("/financings/{id}", saved.getId()).with(user(stranger.getEmail())))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/financings/{id}/balance-syncs", saved.getId())
                .with(user(stranger.getEmail()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"2026/03/28\",\"amount\":40000}"))
        .andExpect(status().isNotFound());
    mvc.perform(
            delete("/financings/{id}", saved.getId()).with(user(stranger.getEmail())).with(csrf()))
        .andExpect(status().isNotFound());
  }
}
