package com.budgetmanager.bm.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.budgetmanager.bm.support.PostgresContainerConfiguration;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
class PaymentMethodsMigrationTest {

  private static final String USER = "00000000-0000-0000-0000-00000000a11c";

  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void backfillsEveryBankAndOnlyCardedTransactions() throws Exception {
    flyway("10").migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      statement.execute(
          "INSERT INTO t_user(id, email, password) VALUES ('"
              + USER
              + "', 'migration@example.com', 'hash')");
      statement.execute(
          "INSERT INTO t_category(id, user_id, name, transaction_type) VALUES ('"
              + USER
              + "', '"
              + USER
              + "', 'Food', 'EXPENSE')");
      for (com.budgetmanager.bm.ledger.domain.Bank bank :
          com.budgetmanager.bm.ledger.domain.Bank.values()) {
        String name =
            bank == com.budgetmanager.bm.ledger.domain.Bank.OTHER
                ? "Local credit union"
                : bank.getDisplayName().toUpperCase(java.util.Locale.ROOT);
        statement.execute(
            "INSERT INTO t_card(id, user_id, name, closing_day, due_day) VALUES (gen_random_uuid(), '"
                + USER
                + "', '"
                + name
                + "', 25, 5)");
      }
      statement.execute(
          "INSERT INTO t_transaction(id, user_id, category_id, total_value, date, repeats, card_id) SELECT gen_random_uuid(), '"
              + USER
              + "', '"
              + USER
              + "', 10, '2026-11-01', 'NONE', id FROM t_card");
      statement.execute(
          "INSERT INTO t_transaction(id, user_id, category_id, total_value, date, repeats) VALUES (gen_random_uuid(), '"
              + USER
              + "', '"
              + USER
              + "', 10, '2026-11-01', 'NONE')");
    }
    flyway(null).migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      for (com.budgetmanager.bm.ledger.domain.Bank bank :
          com.budgetmanager.bm.ledger.domain.Bank.values()) {
        String name =
            bank == com.budgetmanager.bm.ledger.domain.Bank.OTHER
                ? "Local credit union"
                : bank.getDisplayName().toUpperCase(java.util.Locale.ROOT);
        assertThat(value(statement, "SELECT bank FROM t_card WHERE name = '" + name + "'"))
            .isEqualTo(bank.name());
      }
      assertThat(
              value(
                  statement,
                  "SELECT count(*) FROM t_transaction WHERE card_id IS NOT NULL AND payment_method = 'CREDIT_CARD'"))
          .isEqualTo("19");
      assertThat(value(statement, "SELECT payment_method FROM t_transaction WHERE card_id IS NULL"))
          .isNull();
      assertThatThrownBy(() ->
              statement.execute(
                  "UPDATE t_transaction SET payment_method = 'PIX' WHERE card_id IS NOT NULL"))
          .isInstanceOf(SQLException.class);
      statement.execute("DELETE FROM t_card");
      assertThat(
              value(
                  statement, "SELECT count(*) FROM t_transaction WHERE payment_method IS NOT NULL"))
          .isEqualTo("0");
    }
  }

  private static Flyway flyway(String target) {
    var configuration =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .placeholders(
                Map.of("seed_user_email", "", "seed_user_name", "", "seed_user_password_hash", ""));
    if (target != null) {
      configuration.target(target);
    }
    return configuration.load();
  }

  private static Connection connect() throws SQLException {
    return DriverManager.getConnection(
        POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
  }

  private static String value(Statement statement, String sql) throws SQLException {
    try (ResultSet resultSet = statement.executeQuery(sql)) {
      resultSet.next();
      return resultSet.getString(1);
    }
  }
}
