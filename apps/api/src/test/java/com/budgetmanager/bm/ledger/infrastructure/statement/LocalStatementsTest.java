package com.budgetmanager.bm.ledger.infrastructure.statement;

import static org.assertj.core.api.Assertions.assertThat;

import com.budgetmanager.bm.ledger.domain.statement.ParsedStatement;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Runs only on a machine with real statements in the repository's git-ignored {@code statements/}
 * folder. It checks every statement against the total it prints, so a parsing regression shows up
 * without any statement data entering the repository.
 */
@EnabledIf("hasLocalStatements")
class LocalStatementsTest {

  private static final Path STATEMENTS = Path.of("../../statements");

  static boolean hasLocalStatements() {
    return Files.isDirectory(STATEMENTS);
  }

  static Stream<Path> statements() throws IOException {
    try (Stream<Path> files = Files.list(STATEMENTS)) {
      List<Path> list =
          files
              .filter(path -> path.toString().endsWith(".pdf") || path.toString().endsWith(".csv"))
              .sorted()
              .toList();
      return list.stream();
    }
  }

  @ParameterizedTest
  @MethodSource("statements")
  void everyLocalStatementAddsUpToItsPrintedTotal(Path statement) throws IOException {
    ParsedStatement parsed =
        new StatementReaderAdapter()
            .read(Files.readAllBytes(statement), System.getenv("STATEMENT_PASSWORD"));

    assertThat(parsed.lines()).isNotEmpty();
    assertThat(parsed.totalsMatch())
        .as(
            "%s: printed %s, parsed %s",
            statement.getFileName(), parsed.printedTotal(), parsed.parsedTotal())
        .isTrue();
  }
}
