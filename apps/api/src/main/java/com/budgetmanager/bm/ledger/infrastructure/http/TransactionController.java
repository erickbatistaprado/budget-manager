package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.springframework.http.ResponseEntity.*;

import com.budgetmanager.bm.ledger.application.TransactionService;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/transactions")
@RequiredArgsConstructor
public class TransactionController {

  private final TransactionService service;

  @PostMapping
  public ResponseEntity<TransactionDto> save(@Valid @RequestBody TransactionDto dto) {
    Transaction transaction =
        service.save(TransactionConverter.dtoToEntity(dto), dto.category().id());

    URI uri =
        ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(transaction.getId())
            .toUri();

    return created(uri).body(TransactionConverter.entityToDto(transaction));
  }

  @GetMapping
  public ResponseEntity<Page<TransactionDto>> findByTransactionTypeAndDateBetween(
      @RequestParam TransactionType transactionType,
      @RequestParam @DateTimeFormat(pattern = "yyyy/MM/dd") LocalDate startDate,
      @RequestParam @DateTimeFormat(pattern = "yyyy/MM/dd") LocalDate endDate,
      @RequestParam(defaultValue = "date") String sortKey,
      @RequestParam(defaultValue = "asc") String sortOrder,
      @PageableDefault(size = 30) Pageable pageable) {
    return ok(
        service
            .findByTransactionTypeAndDateBetween(
                transactionType, startDate, endDate, sortKey, sortOrder, pageable)
            .map(TransactionConverter::entityToDto));
  }

  @PutMapping
  public ResponseEntity<TransactionDto> update(@Valid @RequestBody TransactionDto dto) {
    return ok(
        TransactionConverter.entityToDto(
            service.update(TransactionConverter.dtoToEntity(dto), dto.category().id())));
  }

  /** Moves installments the card prepaid to the day they were paid. */
  @PostMapping("/{id}/installments/pay-early")
  public ResponseEntity<TransactionDto> payInstallmentsEarly(
      @PathVariable UUID id, @Valid @RequestBody InstallmentChangeDto change) {
    if (change.paidOn() == null) {
      throw new ApplicationException(ApplicationError.BAD_REQUEST, "paidOn is required");
    }
    return ok(
        TransactionConverter.entityToDto(
            service.payInstallmentsEarly(id, change.installmentNumbers(), change.paidOn())));
  }

  /** Puts paid-early installments back in their original months. */
  @PostMapping("/{id}/installments/restore")
  public ResponseEntity<TransactionDto> restoreInstallments(
      @PathVariable UUID id, @Valid @RequestBody InstallmentChangeDto change) {
    return ok(
        TransactionConverter.entityToDto(
            service.restoreInstallments(id, change.installmentNumbers())));
  }

  @PutMapping("/{id}/months/{month}")
  public ResponseEntity<TransactionDto> changeMonth(
      @PathVariable UUID id,
      @PathVariable String month,
      @Valid @RequestBody TransactionMonthChangeDto change) {
    return ok(
        TransactionConverter.entityToDto(
            service.changeMonth(
                id, parseMonth(month), change.amount(), change.date(), change.notes())));
  }

  @DeleteMapping("/{id}/months/{month}")
  public ResponseEntity<Void> skipMonth(@PathVariable UUID id, @PathVariable String month) {
    service.skipMonth(id, parseMonth(month), false);
    return noContent().build();
  }

  @DeleteMapping("/{id}/months/{month}/override")
  public ResponseEntity<Void> restoreMonth(@PathVariable UUID id, @PathVariable String month) {
    service.skipMonth(id, parseMonth(month), true);
    return noContent().build();
  }

  @PostMapping("/{id}/split/{month}")
  public ResponseEntity<TransactionDto> split(
      @PathVariable UUID id,
      @PathVariable String month,
      @Valid @RequestBody TransactionDto change) {
    return ok(
        TransactionConverter.entityToDto(
            service.split(
                id,
                parseMonth(month),
                TransactionConverter.dtoToEntity(change),
                change.category().id())));
  }

  @DeleteMapping("/{id}/from/{month}")
  public ResponseEntity<Void> deleteFrom(@PathVariable UUID id, @PathVariable String month) {
    service.deleteFrom(id, parseMonth(month));
    return noContent().build();
  }

  private YearMonth parseMonth(String month) {
    try {
      return YearMonth.parse(month);
    } catch (java.time.format.DateTimeParseException exception) {
      throw new ApplicationException(
          exception, ApplicationError.BAD_REQUEST, "Use yyyy-MM for a month");
    }
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.deleteById(id);
    return noContent().build();
  }
}
