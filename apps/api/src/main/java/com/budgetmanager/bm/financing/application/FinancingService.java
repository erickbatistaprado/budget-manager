package com.budgetmanager.bm.financing.application;

import com.budgetmanager.bm.financing.domain.Amortization;
import com.budgetmanager.bm.financing.domain.Financing;
import com.budgetmanager.bm.financing.infrastructure.persistence.FinancingRepository;
import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.ledger.application.FinancingLedgerService;
import com.budgetmanager.bm.ledger.domain.PaymentMethod;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class FinancingService {
  private final FinancingRepository repository;
  private final UserService users;
  private final FinancingLedgerService ledger;

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
      Amortization.Terms terms,
      BigDecimal quotedRate,
      Financing.RatePeriod ratePeriod) {
    public Draft(
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
        Amortization.Terms terms) {
      this(
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
          terms,
          terms.monthlyRate(),
          Financing.RatePeriod.MONTHLY);
    }
  }

  public List<Financing> list() {
    return repository.findByUserIdOrderByNameAsc(users.requireCurrentUser().getId());
  }

  public Financing get(UUID id) {
    return repository
        .findByIdAndUserId(id, users.requireCurrentUser().getId())
        .orElseThrow(
            () -> new ApplicationException(ApplicationError.NOT_FOUND, "Financing not found"));
  }

  public Financing save(UUID id, Draft draft) {
    if (draft.name() == null
        || draft.name().isBlank()
        || draft.name().length() > 255
        || draft.kind() == null
        || !List.of("VEHICLE", "REAL_ESTATE", "OTHER").contains(draft.kind())
        || draft.terms() == null
        || draft.categoryId() == null
        || draft.paymentMethod() == null
        || draft.paymentMethod() == PaymentMethod.CREDIT_CARD) {
      throw new IllegalArgumentException(
          "Name, kind, expense category, payment method and contract terms are required");
    }
    for (BigDecimal cost :
        new BigDecimal[] {
          draft.purchasePrice(),
          draft.downPayment(),
          draft.iof(),
          draft.registration(),
          draft.valuationFee()
        }) {
      if (cost != null && cost.signum() < 0) {
        throw new IllegalArgumentException("Contract costs cannot be negative");
      }
    }
    Financing record = id == null ? new Financing() : get(id);
    boolean preserve =
        id != null
            && (!record.getChanges().isEmpty()
                || record.schedule().stream().anyMatch(row -> row.paidAmount() != null));
    if (preserve && !sameTerms(record.getTerms(), draft.terms())) {
      throw new IllegalArgumentException(
          "Use financing adjustments to preserve paid installments and contract changes");
    }
    if (id == null) {
      record.setId(UUID.randomUUID());
      record.setUserId(users.requireCurrentUser().getId());
    }
    record.setName(draft.name().trim());
    record.setKind(draft.kind());
    record.setLender(draft.lender());
    record.setPurchasePrice(draft.purchasePrice());
    record.setDownPayment(draft.downPayment());
    record.setIof(draft.iof());
    record.setRegistration(draft.registration());
    record.setValuationFee(draft.valuationFee());
    record.setCategoryId(draft.categoryId());
    record.setPaymentMethod(draft.paymentMethod().name());
    record.setAccountId(draft.accountId());
    record.setTerms(draft.terms());
    record.setRate(draft.quotedRate());
    record.setRatePeriod(draft.ratePeriod());
    if (!preserve) {
      List<Amortization.Row> schedule = Amortization.schedule(draft.terms());
      int paid =
          draft.alreadyPaid() == null
              ? (int)
                  schedule.stream().filter(row -> row.dueDate().isBefore(LocalDate.now())).count()
              : draft.alreadyPaid();
      if (paid < 0 || paid > schedule.size()) {
        throw new IllegalArgumentException("Already paid count is outside the contract term");
      }
      for (Amortization.Row row : schedule) {
        if (row.number() <= paid) {
          record.addChange(
              new Amortization.Change("PAID", null, row.payment(), null, row.number(), null));
        }
      }
    }
    record = repository.saveAndFlush(record);
    synchronize(record);
    return record;
  }

  public void delete(UUID id) {
    Financing record = get(id);
    ledger.delete(id);
    repository.delete(record);
  }

  public List<Amortization.Simulation> simulate(UUID id, LocalDate date, BigDecimal amount) {
    Financing record = get(id);
    requireChronology(record, date);
    return List.of(
        Amortization.extra(
            record.getTerms(), record.schedule(), date, amount, Amortization.Option.REDUCE_TERM),
        Amortization.extra(
            record.getTerms(),
            record.schedule(),
            date,
            amount,
            Amortization.Option.REDUCE_PAYMENT));
  }

  public Financing extra(UUID id, LocalDate date, BigDecimal amount, Amortization.Option option) {
    Financing record = get(id);
    requireChronology(record, date);
    Amortization.positive(amount, "Extra payment");
    if (option == null) {
      throw new IllegalArgumentException("Choose how to apply the extra payment");
    }
    add(
        record,
        new Amortization.Change(
            "EXTRA_PAYMENT", date, Amortization.money(amount), option.name(), null, null));
    ledger.extra(
        id,
        record.getName(),
        record.getCategoryId(),
        PaymentMethod.valueOf(record.getPaymentMethod()),
        record.getAccountId(),
        date,
        Amortization.money(amount));
    synchronize(record);
    return record;
  }

  public Financing sync(UUID id, LocalDate date, BigDecimal amount) {
    Financing record = get(id);
    requireChronology(record, date);
    if (amount == null || amount.signum() < 0) {
      throw new IllegalArgumentException("Balance cannot be negative");
    }
    add(
        record,
        new Amortization.Change(
            "BALANCE_SYNC", date, Amortization.money(amount), null, null, null));
    synchronize(record);
    return record;
  }

  public Financing paid(UUID id, int number, BigDecimal amount) {
    Financing record = get(id);
    if (number < 1 || number > record.schedule().size()) {
      throw new IllegalArgumentException("Unknown installment");
    }
    Amortization.positive(amount, "Paid amount");
    add(
        record,
        new Amortization.Change("PAID", null, Amortization.money(amount), null, number, null));
    synchronize(record);
    return record;
  }

  public Financing dueDay(UUID id, int from, int day) {
    Financing record = get(id);
    add(record, new Amortization.Change("DUE_DAY", null, null, null, from, day));
    synchronize(record);
    return record;
  }

  private void add(Financing record, Amortization.Change change) {
    record.addChange(change);
  }

  private void requireChronology(Financing record, LocalDate date) {
    if (date == null
        || record.getChanges().stream()
            .anyMatch(change -> change.date() != null && change.date().isAfter(date))) {
      throw new IllegalArgumentException("Apply balance adjustments in chronological order");
    }
  }

  private static boolean sameTerms(Amortization.Terms original, Amortization.Terms revised) {
    return original.system() == revised.system()
        && original.amount().compareTo(revised.amount()) == 0
        && original.monthlyRate().compareTo(revised.monthlyRate()) == 0
        && original.term() == revised.term()
        && original.firstDueDate().equals(revised.firstDueDate())
        && java.util.Objects.equals(original.statedInstallment(), revised.statedInstallment())
        && original.insurance().compareTo(revised.insurance()) == 0
        && original.fees().compareTo(revised.fees()) == 0;
  }

  private void synchronize(Financing record) {
    ledger.synchronize(
        record.getId(),
        record.getName(),
        record.getCategoryId(),
        PaymentMethod.valueOf(record.getPaymentMethod()),
        record.getAccountId(),
        record.getTerms().term(),
        record.getTerms().firstDueDate(),
        record.schedule().stream()
            .map(row ->
                new FinancingLedgerService.Payment(
                    row.number(),
                    row.dueDate(),
                    row.paidAmount() == null ? row.payment() : row.paidAmount()))
            .toList());
    repository.save(record);
  }
}
