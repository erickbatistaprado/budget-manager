package com.budgetmanager.bm.savings.infrastructure.http;

import static org.springframework.http.ResponseEntity.*;

import com.budgetmanager.bm.savings.application.SavingService;
import com.budgetmanager.bm.savings.domain.Saving;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/savings")
@RequiredArgsConstructor
public class SavingController {

  private final SavingService service;
  private final com.budgetmanager.bm.ledger.application.MoneyFlowService money;

  @GetMapping
  public ResponseEntity<List<SavingDto>> findAll() {
    var movements = money.stored();
    return ok(
        service.findAll().stream()
            .map(saving -> {
              var invested =
                  com.budgetmanager.bm.savings.application.SavingHistoryService.invested(
                      saving.getId(), java.time.LocalDate.MAX, movements);
              return new SavingDto(
                  saving.getId(),
                  saving.getName(),
                  saving.getAmount(),
                  saving.getLocation(),
                  saving.getInvestmentType(),
                  saving.getUpdatedAt(),
                  invested,
                  saving.getAmount().subtract(invested));
            })
            .toList());
  }

  @PostMapping
  public ResponseEntity<SavingDto> save(@Valid @RequestBody SavingDraft dto) {
    Saving saving = service.save(SavingConverter.dtoToEntity(dto));
    URI uri =
        ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(saving.getId())
            .toUri();

    return created(uri).body(response(saving));
  }

  @PutMapping
  public ResponseEntity<SavingDto> update(@Valid @RequestBody SavingDraft dto) {
    return ok(response(service.update(SavingConverter.dtoToEntity(dto))));
  }

  private SavingDto response(Saving saving) {
    var invested =
        com.budgetmanager.bm.savings.application.SavingHistoryService.invested(
            saving.getId(), java.time.LocalDate.MAX, money.stored());
    return new SavingDto(
        saving.getId(),
        saving.getName(),
        saving.getAmount(),
        saving.getLocation(),
        saving.getInvestmentType(),
        saving.getUpdatedAt(),
        invested,
        saving.getAmount().subtract(invested));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.deleteById(id);
    return noContent().build();
  }
}
