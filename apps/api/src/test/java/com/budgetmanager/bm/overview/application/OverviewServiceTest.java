package com.budgetmanager.bm.overview.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.budgetmanager.bm.financing.application.FinancingService;
import com.budgetmanager.bm.ledger.application.MoneyFlowService;
import com.budgetmanager.bm.ledger.domain.*;
import com.budgetmanager.bm.savings.application.*;
import com.budgetmanager.bm.savings.domain.Saving;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class OverviewServiceTest {
  @Test
  void evolutionUsesMonthFlowsAndAccountsPlusSavingsMinusDebt() {
    MoneyFlowService ledger = mock(MoneyFlowService.class);
    SavingService savings = mock(SavingService.class);
    SavingMoneyService values = mock(SavingMoneyService.class);
    FinancingService financing = mock(FinancingService.class);
    Clock clock = Clock.fixed(Instant.parse("2026-02-15T12:00:00Z"), ZoneOffset.UTC);
    OverviewService service = new OverviewService(ledger, savings, values, financing, clock);
    UUID accountId = UUID.randomUUID();
    UUID savingId = UUID.randomUUID();
    var entries =
        List.of(
            new TransactionOccurrence(
                LocalDate.of(2026, 1, 1),
                new BigDecimal("1000"),
                TransactionType.INCOME,
                accountId,
                null,
                PaymentMethod.PIX),
            new TransactionOccurrence(
                LocalDate.of(2026, 1, 2),
                new BigDecimal("200"),
                TransactionType.EXPENSE,
                accountId,
                null,
                PaymentMethod.PIX));
    var opening =
        Movement.builder()
            .kind(MovementKind.INVESTMENT)
            .savingId(savingId)
            .date(LocalDate.of(2026, 1, 1))
            .amount(new BigDecimal("100"))
            .opening(true)
            .build();
    var investment =
        Movement.builder()
            .kind(MovementKind.INVESTMENT)
            .savingId(savingId)
            .fromAccountId(accountId)
            .date(LocalDate.of(2026, 2, 1))
            .amount(new BigDecimal("50"))
            .build();
    var snapshot =
        new MoneyFlowService.Snapshot(
            List.of(Account.builder().id(accountId).name("Bank").build()),
            entries,
            List.of(opening, investment),
            List.of(),
            List.of(),
            LocalDate.of(2026, 1, 1));
    when(ledger.snapshot(any(LocalDate.class))).thenReturn(snapshot);
    when(savings.findAll())
        .thenReturn(List.of(Saving.builder().id(savingId).amount(new BigDecimal("150")).build()));
    when(values.valuations(anyList())).thenReturn(List.of());
    when(financing.list()).thenReturn(List.of());
    var result = service.evolution();
    assertThat(result).hasSize(2);
    assertThat(result.getFirst().accounts()).isEqualByComparingTo("800");
    assertThat(result.getFirst().savings()).isEqualByComparingTo("100");
    assertThat(result.getFirst().invested()).isZero();
    assertThat(result.getFirst().netWorth()).isEqualByComparingTo("900");
    assertThat(result.getLast().invested()).isEqualByComparingTo("50");
    assertThat(result.getLast().accounts()).isEqualByComparingTo("750");
    assertThat(result.getLast().netWorth()).isEqualByComparingTo("900");
    var january = service.month(YearMonth.of(2026, 1));
    assertThat(january.surplus()).isEqualByComparingTo("800");
    assertThat(january.kept()).isEqualByComparingTo("800");
  }

  @Test
  void debtUsesTheBalanceAfterTheLastInstallmentDueInEachMonth() {
    MoneyFlowService ledger = mock(MoneyFlowService.class);
    SavingService savings = mock(SavingService.class);
    SavingMoneyService values = mock(SavingMoneyService.class);
    FinancingService financing = mock(FinancingService.class);
    OverviewService service =
        new OverviewService(
            ledger,
            savings,
            values,
            financing,
            Clock.fixed(Instant.parse("2026-02-15T12:00:00Z"), ZoneOffset.UTC));
    when(ledger.snapshot(any(LocalDate.class)))
        .thenReturn(
            new MoneyFlowService.Snapshot(
                List.of(), List.of(), List.of(), List.of(), List.of(), LocalDate.of(2026, 1, 1)));
    when(savings.findAll()).thenReturn(List.of());
    when(values.valuations(anyList())).thenReturn(List.of());
    var loan = new com.budgetmanager.bm.financing.domain.Financing();
    loan.setId(UUID.randomUUID());
    loan.setTerms(
        new com.budgetmanager.bm.financing.domain.Amortization.Terms(
            com.budgetmanager.bm.financing.domain.Amortization.System.SAC,
            new BigDecimal("1000"),
            BigDecimal.ZERO,
            2,
            LocalDate.of(2026, 1, 15),
            null,
            BigDecimal.ZERO,
            BigDecimal.ZERO));
    when(financing.list()).thenReturn(List.of(loan));
    var result = service.evolution();
    assertThat(result.getFirst().debt()).isEqualByComparingTo("500");
    assertThat(result.getFirst().netWorth()).isEqualByComparingTo("-500");
    assertThat(result.getLast().debt()).isZero();
    assertThat(result.getLast().netWorth()).isZero();
  }
}
