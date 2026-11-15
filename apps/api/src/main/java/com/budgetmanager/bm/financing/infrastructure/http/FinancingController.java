package com.budgetmanager.bm.financing.infrastructure.http;

import com.budgetmanager.bm.financing.application.FinancingService;
import com.budgetmanager.bm.financing.domain.Amortization;
import com.budgetmanager.bm.financing.domain.Financing;
import com.budgetmanager.bm.ledger.domain.PaymentMethod;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/financings")
@RequiredArgsConstructor
public class FinancingController {
  private final FinancingService service;

  public record Draft(
      String name,
      String kind,
      String lender,
      BigDecimal purchasePrice,
      BigDecimal downPayment,
      BigDecimal iof,
      BigDecimal registration,
      BigDecimal valuationFee,
      UUID categoryId,
      PaymentMethod paymentMethod,
      UUID accountId,
      Integer alreadyPaid,
      Amortization.System system,
      BigDecimal amount,
      BigDecimal annualRate,
      BigDecimal monthlyRate,
      int term,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate firstDueDate,
      BigDecimal statedInstallment,
      BigDecimal insurance,
      BigDecimal fees) {
    Amortization.Terms terms() {
      return new Amortization.Terms(
          system,
          amount,
          monthlyRate == null ? Amortization.monthlyRateFromAnnual(annualRate) : monthlyRate,
          term,
          firstDueDate,
          statedInstallment,
          insurance,
          fees);
    }

    FinancingService.Draft command() {
      return new FinancingService.Draft(
          name,
          kind,
          lender,
          purchasePrice,
          downPayment,
          iof,
          registration,
          valuationFee,
          categoryId,
          paymentMethod,
          accountId,
          alreadyPaid,
          terms(),
          monthlyRate == null ? annualRate : monthlyRate,
          monthlyRate == null ? Financing.RatePeriod.ANNUAL : Financing.RatePeriod.MONTHLY);
    }
  }

  public record Row(
      int number,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate dueDate,
      BigDecimal principal,
      BigDecimal interest,
      BigDecimal insurance,
      BigDecimal fees,
      BigDecimal payment,
      BigDecimal balance,
      BigDecimal paidAmount,
      String status) {
    static Row from(Amortization.Row row) {
      return new Row(
          row.number(),
          row.dueDate(),
          row.principal(),
          row.interest(),
          row.insurance(),
          row.fees(),
          row.payment(),
          row.balance(),
          row.paidAmount(),
          row.paidAmount() == null ? "SCHEDULED" : "PAID");
    }
  }

  public record Preview(
      BigDecimal effectiveMonthlyRate,
      BigDecimal totalInterest,
      BigDecimal totalPaid,
      List<Row> schedule) {
    public Preview {
      schedule = List.copyOf(schedule);
    }
  }

  public record Contract(
      UUID id,
      Draft contract,
      Preview calculation,
      BigDecimal extraPaid,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate payoffDate) {}

  public record Adjustment(
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate date,
      BigDecimal amount,
      Amortization.Option option) {}

  public record DueDay(int fromInstallment, int dueDay) {}

  public record Paid(BigDecimal amount) {}

  public record Simulation(
      Amortization.Option option, BigDecimal interestSaved, List<Row> schedule) {
    public Simulation {
      schedule = List.copyOf(schedule);
    }
  }

  @GetMapping
  public List<Contract> list() {
    return service.list().stream().map(FinancingController::response).toList();
  }

  @GetMapping("/{id}")
  public Contract get(@PathVariable UUID id) {
    return response(service.get(id));
  }

  @GetMapping("/{id}/schedule")
  public List<Row> schedule(@PathVariable UUID id) {
    return service.get(id).schedule().stream().map(Row::from).toList();
  }

  @PostMapping("/preview")
  public Preview preview(@RequestBody Draft draft) {
    return checked(() -> calculation(draft.terms(), Amortization.schedule(draft.terms())));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Contract create(@RequestBody Draft draft) {
    return checked(() -> response(service.save(null, draft.command())));
  }

  @PutMapping("/{id}")
  public Contract update(@PathVariable UUID id, @RequestBody Draft draft) {
    return checked(() -> response(service.save(id, draft.command())));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }

  @PostMapping("/{id}/extra-payments/simulate")
  public List<Simulation> simulate(@PathVariable UUID id, @RequestBody Adjustment change) {
    return checked(() ->
        service.simulate(id, change.date(), change.amount()).stream()
            .map(result ->
                new Simulation(
                    result.option(),
                    result.interestSaved(),
                    result.schedule().stream().map(Row::from).toList()))
            .toList());
  }

  @PostMapping("/{id}/extra-payments")
  public Contract extra(@PathVariable UUID id, @RequestBody Adjustment change) {
    return checked(
        () -> response(service.extra(id, change.date(), change.amount(), change.option())));
  }

  @PostMapping("/{id}/balance-syncs")
  public Contract sync(@PathVariable UUID id, @RequestBody Adjustment change) {
    return checked(() -> response(service.sync(id, change.date(), change.amount())));
  }

  @PostMapping("/{id}/installments/{number}/paid")
  public Contract paid(@PathVariable UUID id, @PathVariable int number, @RequestBody Paid paid) {
    return checked(() -> response(service.paid(id, number, paid.amount())));
  }

  @PostMapping("/{id}/due-day-changes")
  public Contract dueDay(@PathVariable UUID id, @RequestBody DueDay change) {
    return checked(() -> response(service.dueDay(id, change.fromInstallment(), change.dueDay())));
  }

  private static Preview calculation(Amortization.Terms terms, List<Amortization.Row> rows) {
    return new Preview(
        terms.effectiveRate(),
        Amortization.interest(rows),
        rows.stream().map(Amortization.Row::payment).reduce(BigDecimal.ZERO, BigDecimal::add),
        rows.stream().map(Row::from).toList());
  }

  private static Contract response(Financing record) {
    Amortization.Terms terms = record.getTerms();
    Draft draft =
        new Draft(
            record.getName(),
            record.getKind(),
            record.getLender(),
            record.getPurchasePrice(),
            record.getDownPayment(),
            record.getIof(),
            record.getRegistration(),
            record.getValuationFee(),
            record.getCategoryId(),
            PaymentMethod.valueOf(record.getPaymentMethod()),
            record.getAccountId(),
            null,
            terms.system(),
            terms.amount(),
            null,
            terms.monthlyRate(),
            terms.term(),
            terms.firstDueDate(),
            terms.statedInstallment(),
            terms.insurance(),
            terms.fees());
    return new Contract(
        record.getId(),
        draft,
        calculation(terms, record.schedule()),
        record.getChanges().stream()
            .filter(change -> "EXTRA_PAYMENT".equals(change.type()))
            .map(Amortization.Change::amount)
            .reduce(BigDecimal.ZERO, BigDecimal::add),
        payoffDate(record));
  }

  private static LocalDate payoffDate(Financing record) {
    LocalDate payoff =
        record.schedule().isEmpty()
            ? record.getTerms().firstDueDate()
            : record.schedule().getLast().dueDate();
    for (Amortization.Change change : record.getChanges()) {
      if (change.date() != null && (record.schedule().isEmpty() || change.date().isAfter(payoff))) {
        payoff = change.date();
      }
    }
    return payoff;
  }

  private static <Result> Result checked(Supplier<Result> action) {
    try {
      return action.get();
    } catch (IllegalArgumentException exception) {
      throw new ApplicationException(
          exception, ApplicationError.BAD_REQUEST, exception.getMessage());
    }
  }
}
