package com.budgetmanager.bm.financing.domain;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class AmortizationTest {
  private Amortization.Terms terms(Amortization.System system, String stated) {
    return new Amortization.Terms(
        system,
        new BigDecimal("50000"),
        new BigDecimal("0.015"),
        36,
        LocalDate.of(2026, 1, 28),
        stated == null ? null : new BigDecimal(stated),
        BigDecimal.ZERO,
        BigDecimal.ZERO);
  }

  @Test
  void priceMatchesFormulaAndStatedPaymentDerivesRate() {
    var computed = Amortization.schedule(terms(Amortization.System.PRICE, null));
    assertThat(computed.getFirst().payment()).isEqualByComparingTo("1807.62");
    var stated = terms(Amortization.System.PRICE, "1815");
    assertThat(stated.effectiveRate()).isGreaterThan(stated.monthlyRate());
    var rows = Amortization.schedule(stated);
    assertThat(rows.getFirst().payment()).isEqualByComparingTo("1815");
    assertThat(rows.getLast().balance()).isEqualByComparingTo("0");
    assertThat(
            rows.stream().map(Amortization.Row::principal).reduce(BigDecimal.ZERO, BigDecimal::add))
        .isEqualByComparingTo("50000");
  }

  @Test
  void sacFallsAndFinalPrincipalAbsorbsRounding() {
    var rows = Amortization.schedule(terms(Amortization.System.SAC, null));
    assertThat(rows).hasSize(36);
    assertThat(rows.getFirst().interest()).isEqualByComparingTo("750");
    assertThat(rows.getFirst().payment()).isGreaterThan(rows.getLast().payment());
    assertThat(rows.getLast().balance()).isEqualByComparingTo("0");
    assertThat(
            rows.stream().map(Amortization.Row::principal).reduce(BigDecimal.ZERO, BigDecimal::add))
        .isEqualByComparingTo("50000");
  }

  @Test
  void bothExtraOptionsSaveInterestAndCanBeRepeatedNearTheEnd() {
    for (var system : Amortization.System.values()) {
      var terms = terms(system, null);
      var original = Amortization.schedule(terms);
      for (var option : Amortization.Option.values()) {
        var result =
            Amortization.extra(
                terms, original, LocalDate.of(2026, 3, 28), new BigDecimal("5000"), option);
        assertThat(result.interestSaved()).isPositive();
        assertThat(result.schedule().getFirst()).isEqualTo(original.getFirst());
        assertThat(result.schedule().getLast().balance()).isEqualByComparingTo("0");
        if (option == Amortization.Option.REDUCE_TERM) {
          assertThat(result.schedule().size()).isLessThan(original.size());
        } else {
          assertThat(result.schedule()).hasSize(36);
        }
        var second =
            Amortization.extra(
                terms,
                result.schedule(),
                LocalDate.of(2026, 4, 28),
                new BigDecimal("1000"),
                option);
        var beforeLast = second.schedule().get(second.schedule().size() - 2);
        var last =
            Amortization.extra(
                terms, second.schedule(), beforeLast.dueDate(), beforeLast.balance(), option);
        assertThat(last.schedule().getLast().balance()).isEqualByComparingTo(beforeLast.balance());
        assertThat(last.schedule()).hasSize(second.schedule().size() - 1);
      }
    }
  }

  @Test
  void syncAndPaidAmountsPreserveHistory() {
    var terms = terms(Amortization.System.PRICE, null);
    var rows = new java.util.ArrayList<>(Amortization.schedule(terms));
    rows.set(0, rows.getFirst().paid(new BigDecimal("1820")));
    var synced = Amortization.sync(terms, rows, LocalDate.of(2026, 1, 28), new BigDecimal("48000"));
    assertThat(synced.getFirst()).isEqualTo(rows.getFirst());
    assertThat(synced.getFirst().paidAmount()).isEqualByComparingTo("1820");
    assertThat(synced.getLast().balance()).isEqualByComparingTo("0");
    assertThatThrownBy(
            () -> Amortization.sync(terms, rows, LocalDate.of(2025, 12, 1), BigDecimal.TEN))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void dueDayChangesKeepAmountsAndShiftMonthsWithoutDrift() {
    var rows = Amortization.schedule(terms(Amortization.System.PRICE, null));
    var changed = Amortization.changeDueDay(rows, 11, 7);
    assertThat(changed.get(10).dueDate()).isEqualTo(LocalDate.of(2026, 12, 7));
    assertThat(changed.get(11).dueDate()).isEqualTo(LocalDate.of(2027, 1, 7));
    assertThat(changed.get(10).payment()).isEqualTo(rows.get(10).payment());
    var later = Amortization.changeDueDay(rows, 2, 31);
    assertThat(later.get(1).dueDate()).isEqualTo(LocalDate.of(2026, 2, 28));
    assertThat(later.get(2).dueDate()).isEqualTo(LocalDate.of(2026, 3, 31));
  }

  @Test
  void zeroRateAndInvalidPayments() {
    var terms =
        new Amortization.Terms(
            Amortization.System.PRICE,
            BigDecimal.TEN,
            BigDecimal.ZERO,
            3,
            LocalDate.of(2026, 1, 1),
            null,
            null,
            null);
    var rows = Amortization.schedule(terms);
    assertThat(rows.getLast().payment()).isEqualByComparingTo("3.34");
    assertThatThrownBy(() -> terms(Amortization.System.PRICE, "1000"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() ->
            Amortization.extra(
                terms,
                rows,
                LocalDate.of(2025, 12, 1),
                new BigDecimal("11"),
                Amortization.Option.REDUCE_TERM))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void repeatedAdjustmentsOnTheSameDateUseTheAdjustedBalance() {
    var terms = terms(Amortization.System.PRICE, null);
    var original = Amortization.schedule(terms);
    LocalDate date = LocalDate.of(2025, 12, 28);
    var first =
        Amortization.extra(
            terms, original, date, new BigDecimal("1000"), Amortization.Option.REDUCE_PAYMENT);
    var second =
        Amortization.extra(
            terms,
            first.schedule(),
            date,
            new BigDecimal("2000"),
            Amortization.Option.REDUCE_PAYMENT);
    assertThat(
            second.schedule().stream()
                .map(Amortization.Row::principal)
                .reduce(BigDecimal.ZERO, BigDecimal::add))
        .isEqualByComparingTo("47000");
    var synced = Amortization.sync(terms, second.schedule(), date, new BigDecimal("46000"));
    var third =
        Amortization.extra(
            terms, synced, date, new BigDecimal("1000"), Amortization.Option.REDUCE_PAYMENT);
    assertThat(
            third.schedule().stream()
                .map(Amortization.Row::principal)
                .reduce(BigDecimal.ZERO, BigDecimal::add))
        .isEqualByComparingTo("45000");
  }

  @Test
  void convertsAnnualRatesAndSupportsZeroRateStatedPayments() {
    assertThat(Amortization.monthlyRateFromAnnual(new BigDecimal("0.195618171461535")))
        .isCloseTo(new BigDecimal("0.015"), within(new BigDecimal("0.0000000001")));
    var terms =
        new Amortization.Terms(
            Amortization.System.PRICE,
            new BigDecimal("3600"),
            new BigDecimal("0.01"),
            36,
            LocalDate.of(2026, 1, 1),
            new BigDecimal("100"),
            null,
            null);
    assertThat(terms.effectiveRate()).isEqualByComparingTo("0");
    assertThat(Amortization.schedule(terms).getLast().balance()).isEqualByComparingTo("0");
  }

  @Test
  void replaysOrderedChangesWithoutRewritingPaidHistory() {
    var terms = terms(Amortization.System.PRICE, null);
    var changes =
        java.util.List.of(
            new Amortization.Change("PAID", null, new BigDecimal("1810"), null, 1, null),
            new Amortization.Change(
                "EXTRA_PAYMENT",
                LocalDate.of(2026, 1, 28),
                new BigDecimal("1000"),
                "REDUCE_PAYMENT",
                null,
                null),
            new Amortization.Change(
                "BALANCE_SYNC",
                LocalDate.of(2026, 2, 28),
                new BigDecimal("47000"),
                null,
                null,
                null),
            new Amortization.Change("DUE_DAY", null, null, null, 11, 7));
    var result = Amortization.replay(terms, changes);
    assertThat(result).isEqualTo(Amortization.replay(terms, changes));
    assertThat(result.getFirst().paidAmount()).isEqualByComparingTo("1810");
    assertThat(result.getFirst().principal())
        .isEqualTo(Amortization.schedule(terms).getFirst().principal());
    assertThat(result.get(10).dueDate()).isEqualTo(LocalDate.of(2026, 12, 7));
    assertThat(result.getLast().balance()).isEqualByComparingTo("0");
  }
}
