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
class CardsMigrationTest {

  private static final String USER = "00000000-0000-0000-0000-00000000a11c";

  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void preservesOldPurchasesAndEnforcesCardConstraints() throws Exception {
    flyway("9").migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      statement.execute(
          """
          INSERT INTO t_user (id, email, password) VALUES ('%1$s', 'alex@example.com', 'hash');
          INSERT INTO t_category (id, name, transaction_type, user_id) VALUES ('%1$s', 'Condo', 'EXPENSE', '%1$s');
          INSERT INTO t_transaction (id, category_id, user_id, total_value, date, repeats) VALUES ('%1$s', '%1$s', '%1$s', 700, '2026-01-31', 'MONTHLY');
          """
              .formatted(USER));
    }
    flyway("10").migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      assertThat(value(statement, "SELECT card_id FROM t_transaction")).isNull();
      assertThat(value(statement, "SELECT bill_due_date FROM t_transaction")).isNull();
      statement.execute(
          "INSERT INTO t_card (id, user_id, name, closing_day, due_day) VALUES ('"
              + USER
              + "', '"
              + USER
              + "', 'Visa', 25, 5)");
      assertThatThrownBy(() ->
              statement.execute(
                  "INSERT INTO t_card (id, user_id, name, closing_day, due_day) VALUES (gen_random_uuid(), '"
                      + USER
                      + "', 'VISA', 25, 5)"))
          .isInstanceOf(SQLException.class);
      assertThatThrownBy(() -> statement.execute("UPDATE t_card SET due_day = 32"))
          .isInstanceOf(SQLException.class);
      statement.execute(
          "UPDATE t_transaction SET repeats = 'NONE', card_id = '"
              + USER
              + "', bill_due_date = '2027-01-05'");
      statement.execute("DELETE FROM t_card");
      assertThat(value(statement, "SELECT card_id FROM t_transaction")).isNull();
      assertThat(value(statement, "SELECT bill_due_date FROM t_transaction"))
          .isEqualTo("2027-01-05");
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
