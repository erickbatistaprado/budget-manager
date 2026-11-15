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

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.deleteById(id);
    return noContent().build();
  }
}
