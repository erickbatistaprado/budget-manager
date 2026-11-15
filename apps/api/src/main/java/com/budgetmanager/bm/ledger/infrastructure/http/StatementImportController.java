package com.budgetmanager.bm.ledger.infrastructure.http;

import static org.springframework.http.ResponseEntity.ok;

import com.budgetmanager.bm.ledger.application.StatementImportService;
import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.infrastructure.http.StatementImportDtos.StatementImportLineDto;
import com.budgetmanager.bm.ledger.infrastructure.http.StatementImportDtos.StatementImportRequestDto;
import com.budgetmanager.bm.ledger.infrastructure.http.StatementImportDtos.StatementImportResultDto;
import com.budgetmanager.bm.ledger.infrastructure.http.StatementImportDtos.StatementPreviewDto;
import com.budgetmanager.bm.ledger.infrastructure.http.StatementImportDtos.StatementPreviewLineDto;
import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import jakarta.validation.Valid;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/statement-imports")
@RequiredArgsConstructor
public class StatementImportController {

  private final StatementImportService service;

  /** Reads a statement and shows what would be imported. Nothing is saved. */
  @PostMapping(path = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<StatementPreviewDto> preview(
      @RequestParam("file") MultipartFile file,
      @RequestParam(value = "password", required = false) String password) {
    byte[] content;
    try {
      content = file.getBytes();
    } catch (IOException exception) {
      throw new ApplicationException(
          exception, ApplicationError.BAD_REQUEST, "The file could not be read");
    }
    StatementImportService.Preview preview = service.preview(content, password);
    return ok(
        new StatementPreviewDto(
            preview.statement().source(),
            preview.statement().printedTotal(),
            preview.statement().parsedTotal(),
            preview.statement().totalsMatch(),
            preview.lines().stream()
                .map(previewLine ->
                    new StatementPreviewLineDto(
                        previewLine.index(),
                        previewLine.line().date(),
                        previewLine.line().description(),
                        previewLine.line().amount(),
                        previewLine.line().credit(),
                        previewLine.line().installmentNumber(),
                        previewLine.line().installmentTotal(),
                        previewLine.line().paidEarly(),
                        previewLine.line().cardholder(),
                        previewLine.suggestedCategoryId(),
                        previewLine.suggestionSource() == null
                            ? null
                            : previewLine.suggestionSource().name(),
                        previewLine.suggestionBasis(),
                        previewLine.suggestionCount(),
                        previewLine.merchantKey(),
                        previewLine.duplicate(),
                        previewLine.duplicateOfTransactionId(),
                        previewLine.duplicateOfLine(),
                        previewLine.samePurchaseAsLine(),
                        previewLine.samePurchaseAsTransactionId(),
                        previewLine.selected()))
                .toList()));
  }

  /** Saves the chosen lines, skipping any that are already saved. */
  @PostMapping
  public ResponseEntity<StatementImportResultDto> importLines(
      @Valid @RequestBody StatementImportRequestDto request) {
    StatementImportService.ImportResult result =
        service.importLines(
            request.lines().stream().map(StatementImportController::toLineToImport).toList());
    return ok(
        new StatementImportResultDto(
            result.imported(), result.skippedAsDuplicates(), result.movedInstallments()));
  }

  private static StatementImportService.LineToImport toLineToImport(StatementImportLineDto dto) {
    boolean installment = dto.installmentTotal() != null && dto.installmentNumber() != null;
    if (installment && dto.installmentNumber() > dto.installmentTotal()) {
      throw new ApplicationException(
          ApplicationError.BAD_REQUEST, "Installment {} is past the last one", dto.description());
    }
    return new StatementImportService.LineToImport(
        new StatementLine(
            dto.date(),
            dto.description(),
            dto.amount(),
            dto.credit(),
            installment ? dto.installmentNumber() : null,
            installment ? dto.installmentTotal() : null,
            null,
            installment && dto.paidEarly()),
        dto.categoryId());
  }
}
