package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.Card;
import com.budgetmanager.bm.ledger.domain.Transaction;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public final class TransactionConverter {

  private TransactionConverter() {}

  public static TransactionDto entityToDto(Transaction entity) {
    return TransactionDto.builder()
        .id(entity.getId())
        .card(
            entity.getCard() == null
                ? null
                : new CardSummaryDto(entity.getCard().getId(), entity.getCard().getName()))
        .billDueDate(entity.getBillDueDate())
        .notes(entity.getNotes())
        .repeats(entity.getRepeats())
        .repeatUntil(entity.getRepeatUntil())
        .months(
            entity.getMonths().stream()
                .sorted(Comparator.comparing(change -> change.getMonth()))
                .map(change ->
                    new TransactionMonthDto(
                        YearMonth.from(change.getMonth()).toString(),
                        change.getAmount(),
                        change.getDate(),
                        change.getNotes(),
                        change.isSkipped()))
                .toList())
        .date(entity.getDate())
        .totalValue(entity.getTotalValue())
        .installmentNumbers(entity.getInstallmentNumbers())
        .category(CategoryConverter.entityToDto(entity.getCategory()))
        .installments(
            Optional.ofNullable(entity.getInstallments()).orElse(List.of()).stream()
                .sorted(
                    Comparator.comparing(
                        installment -> installment.getInstallmentNumber(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(InstallmentConverter::entityToDto)
                .toList())
        .build();
  }

  /** Category and installments are left out: the service resolves and schedules them. */
  public static Transaction dtoToEntity(TransactionDto dto) {
    return Transaction.builder()
        .id(dto.id())
        .card(dto.cardId() == null ? null : Card.builder().id(dto.cardId()).build())
        .notes(dto.notes())
        .repeats(dto.repeats())
        .date(dto.date())
        .totalValue(dto.totalValue())
        .installmentNumbers(dto.installmentNumbers())
        .build();
  }
}
