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
class MonthlyChangesMigrationTest {

  private static final String USER = "00000000-0000-0000-0000-00000000a11c";

  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void preservesExistingSeriesAndEnforcesMonthConstraints() throws Exception {
    flyway("8").migrate();
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
    flyway(null).migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      assertThat(value(statement, "SELECT repeat_until FROM t_transaction")).isNull();
      assertThat(value(statement, "SELECT total_value FROM t_transaction")).isEqualTo("700.00");
      String insert =
          "INSERT INTO t_transaction_month (id, transaction_id, month, amount, date) VALUES (gen_random_uuid(), '"
              + USER
              + "', '2026-12-01', 680, '2026-12-05')";
      statement.execute(insert);
      assertThatThrownBy(() -> statement.execute(insert)).isInstanceOf(SQLException.class);
      assertThatThrownBy(
              () -> statement.execute("UPDATE t_transaction_month SET date = '2026-11-30'"))
          .isInstanceOf(SQLException.class);
      assertThatThrownBy(
              () -> statement.execute("UPDATE t_transaction_month SET month = '2026-12-02'"))
          .isInstanceOf(SQLException.class);
      statement.execute("DELETE FROM t_transaction WHERE id = '" + USER + "'");
      assertThat(value(statement, "SELECT count(*) FROM t_transaction_month")).isEqualTo("0");
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
