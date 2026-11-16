package com.budgetmanager.bm.ledger.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CardLimit(BigDecimal creditLimit, BigDecimal usedLimit, BigDecimal availableLimit) {
  public static CardLimit calculate(
      Card card, List<MoneyFlow.Bill> bills, List<Movement> movements, LocalDate today) {
    if (card.getCreditLimit() == null) {
      return new CardLimit(null, null, null);
    }
    BigDecimal used =
        bills.stream()
            .filter(bill -> card.getId().equals(bill.cardId()))
            .filter(bill ->
                !(bill.dueDate().isBefore(today)
                    && movements.stream()
                        .anyMatch(movement ->
                            movement.getKind() == MovementKind.CARD_BILL_PAYMENT
                                && MoneyFlow.sameBill(movement, bill))))
            .map(MoneyFlow.Bill::total)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return new CardLimit(card.getCreditLimit(), used, card.getCreditLimit().subtract(used));
  }
}
