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
class InvestmentTypeMigrationTest {

  private static final String USER = "00000000-0000-0000-0000-00000000a11c";

  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void existingInvestmentsBecomeOtherInvestmentsAndTheRuleIsEnforced() throws Exception {
    flyway("5").migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      statement.execute(
          """
          INSERT INTO t_user (id, email, password) VALUES ('%1$s', 'alex@example.com', 'hash');
          INSERT INTO t_saving (id, name, amount, location, user_id) VALUES
            (gen_random_uuid(), 'Broker', 100.00, 'INVESTMENT', '%1$s'),
            (gen_random_uuid(), 'Wallet', 10.00, 'CASH', '%1$s');
          """
              .formatted(USER));
    }

    flyway(null).migrate();

    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      assertThat(value(statement, "SELECT investment_type FROM t_saving WHERE name = 'Broker'"))
          .isEqualTo("OTHER_INVESTMENT");
      assertThat(value(statement, "SELECT investment_type FROM t_saving WHERE name = 'Wallet'"))
          .isNull();
      assertThatThrownBy(() ->
              statement.execute(
                  "INSERT INTO t_saving (id, name, amount, location, user_id) VALUES"
                      + " (gen_random_uuid(), 'Bad', 1, 'INVESTMENT', '"
                      + USER
                      + "')"))
          .isInstanceOf(SQLException.class);
      assertThatThrownBy(() ->
              statement.execute(
                  "INSERT INTO t_saving (id, name, amount, location, investment_type, user_id)"
                      + " VALUES (gen_random_uuid(), 'Bad', 1, 'CASH', 'CRYPTO', '"
                      + USER
                      + "')"))
          .isInstanceOf(SQLException.class);
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
