package com.budgetmanager.bm.financing.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "t_financing")
@Getter
@Setter
@NoArgsConstructor
public class Financing {
  @Id private UUID id;
  @Version private long version;

  @Column(nullable = false)
  private UUID userId;

  @Column(nullable = false)
  private String name;

  private String kind;
  private String lender;
  private BigDecimal purchasePrice;
  private BigDecimal downPayment;
  private BigDecimal iof;
  private BigDecimal registration;
  private BigDecimal valuationFee;
  private UUID categoryId;
  private String paymentMethod;
  private UUID accountId;

  @Enumerated(EnumType.STRING)
  private Amortization.System system;

  @Column(precision = 19, scale = 2)
  private BigDecimal amount;

  @Column(precision = 60, scale = 40)
  private BigDecimal rate;

  @Enumerated(EnumType.STRING)
  private RatePeriod ratePeriod = RatePeriod.MONTHLY;

  private int term;
  private LocalDate firstDueDate;
  private BigDecimal statedInstallment;
  private BigDecimal insurance;
  private BigDecimal fees;
  private String correctionIndex = "NONE";

  public enum RatePeriod {
    MONTHLY,
    ANNUAL
  }

  @Setter(lombok.AccessLevel.NONE)
  @Getter(lombok.AccessLevel.NONE)
  @OneToMany(mappedBy = "financing", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("sequence ASC")
  private List<FinancingChange> changes = new ArrayList<>();

  public Amortization.Terms getTerms() {
    return new Amortization.Terms(
        system,
        amount,
        ratePeriod == RatePeriod.ANNUAL ? Amortization.monthlyRateFromAnnual(rate) : rate,
        term,
        firstDueDate,
        statedInstallment,
        insurance,
        fees);
  }

  public void setTerms(Amortization.Terms terms) {
    system = terms.system();
    amount = terms.amount();
    rate = terms.monthlyRate();
    ratePeriod = RatePeriod.MONTHLY;
    term = terms.term();
    firstDueDate = terms.firstDueDate();
    statedInstallment = terms.statedInstallment();
    insurance = terms.insurance();
    fees = terms.fees();
  }

  public List<Amortization.Row> schedule() {
    return Amortization.replay(getTerms(), getChanges());
  }

  public List<Amortization.Change> getChanges() {
    return changes.stream().map(FinancingChange::toAmortization).toList();
  }

  public void addChange(Amortization.Change change) {
    var revised = new ArrayList<>(getChanges());
    revised.add(change);
    Amortization.replay(getTerms(), revised);
    changes.add(new FinancingChange(this, changes.size(), change));
    // Child inserts must also participate in optimistic locking of the aggregate.
    versionMarker++;
  }

  private long versionMarker;
}
