package com.budgetmanager.bm.financing.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "t_financing_change",
    uniqueConstraints = @UniqueConstraint(columnNames = {"financing_id", "sequence"}))
@NoArgsConstructor(access = lombok.AccessLevel.PROTECTED)
public class FinancingChange {
  public enum Type {
    EXTRA_PAYMENT,
    PAID_AMOUNT,
    BALANCE_SYNC,
    DUE_DAY
  }

  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "financing_id", nullable = false)
  private Financing financing;

  @Column(nullable = false)
  private int sequence;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Type type;

  private LocalDate date;
  private Integer installmentNumber;

  @Column(precision = 19, scale = 2)
  private BigDecimal amount;

  @Enumerated(EnumType.STRING)
  private Amortization.Option option;

  private Integer dueDay;

  FinancingChange(Financing financing, int sequence, Amortization.Change change) {
    id = UUID.randomUUID();
    this.financing = financing;
    this.sequence = sequence;
    type = "PAID".equals(change.type()) ? Type.PAID_AMOUNT : Type.valueOf(change.type());
    date = change.date();
    installmentNumber = change.fromInstallment();
    amount = change.amount();
    option = change.option() == null ? null : Amortization.Option.valueOf(change.option());
    dueDay = change.dueDay();
  }

  public Amortization.Change toAmortization() {
    return new Amortization.Change(
        type == Type.PAID_AMOUNT ? "PAID" : type.name(),
        date,
        amount,
        option == null ? null : option.name(),
        installmentNumber,
        dueDay);
  }
}
