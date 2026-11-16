package com.budgetmanager.bm.ledger.infrastructure.http;

import com.budgetmanager.bm.ledger.domain.statement.StatementSource;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class StatementImportDtos {

  private StatementImportDtos() {}

  public record StatementPreviewDto(
      StatementSource source,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate billDueDate,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate statementDate,
      BigDecimal printedTotal,
      BigDecimal parsedTotal,
      boolean totalsMatch,
      List<StatementPreviewLineDto> lines) {

    public StatementPreviewDto {
      lines = List.copyOf(lines);
    }
  }

  public record StatementPreviewLineDto(
      int index,
      @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy/MM/dd") LocalDate date,
      String description,
      BigDecimal amount,
      boolean credit,
      Integer installmentNumber,
      Integer installmentTotal,
      boolean paidEarly,
      String cardholder,
      UUID suggestedCategoryId,
      String suggestionSource,
      String suggestionBasis,
      int suggestionCount,
      String merchantKey,
      boolean duplicate,
      UUID duplicateOfTransactionId,
      Integer duplicateOfLine,
      Integer samePurchaseAsLine,
      UUID samePurchaseAsTransactionId,
      boolean selected,
      String subscriptionName,
      boolean updateMonthAvailable) {}

  public record StatementImportRequestDto(
      UUID cardId,
      @JsonFormat(pattern = "yyyy/MM/dd") LocalDate billDueDate,
      @NotEmpty @Size(max = 2000) List<@Valid @NotNull StatementImportLineDto> lines) {

    public StatementImportRequestDto {
      lines = lines == null ? List.of() : List.copyOf(lines);
    }
  }

  public record StatementImportLineDto(
      @NotNull @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy/MM/dd") LocalDate date,
      @NotBlank @Size(max = 255) String description,
      @NotNull @Positive BigDecimal amount,
      boolean credit,
      @Min(1) @Max(500) Integer installmentNumber,
      @Min(2) @Max(500) Integer installmentTotal,
      boolean paidEarly,
      @NotNull UUID categoryId,
      boolean updateMonth) {}

  public record StatementImportResultDto(
      int imported,
      int skippedAsDuplicates,
      int movedInstallments,
      int billDatesSet,
      int installmentAmountsAdjusted) {}
}
