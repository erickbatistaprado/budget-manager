package com.budgetmanager.bm.ledger.infrastructure.http;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

/**
 * Installments to pay early or put back. {@code paidOn} is required to pay early and ignored when
 * restoring.
 */
public record InstallmentChangeDto(
    @NotEmpty List<@NotNull Integer> installmentNumbers,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy/MM/dd") LocalDate paidOn) {

  public InstallmentChangeDto {
    installmentNumbers = installmentNumbers == null ? List.of() : List.copyOf(installmentNumbers);
  }
}
