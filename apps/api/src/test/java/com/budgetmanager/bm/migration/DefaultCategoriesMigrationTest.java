package com.budgetmanager.bm.migration;

import static org.assertj.core.api.Assertions.assertThat;

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
class DefaultCategoriesMigrationTest {

  private static final String USER = "00000000-0000-0000-0000-00000000a11c";

  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void existingUsersGetTheMissingDefaultsWithoutDuplicates() throws Exception {
    flyway("3").migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      statement.execute(
          """
          INSERT INTO t_user (id, email, password) VALUES ('%1$s', 'alex@example.com', 'hash');
          INSERT INTO t_category (id, name, transaction_type, user_id) VALUES
            (gen_random_uuid(), 'groceries', 'EXPENSE', '%1$s'),
            (gen_random_uuid(), 'Coffee', 'EXPENSE', '%1$s'),
            (gen_random_uuid(), 'Personal Care', 'EXPENSE', '%1$s');
          """
              .formatted(USER));
    }

    flyway(null).migrate();

    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      long defaults = count(statement, "SELECT count(*) FROM t_default_category");
      assertThat(defaults).isEqualTo(32);
      assertThat(count(statement, "SELECT count(*) FROM t_category WHERE user_id = '" + USER + "'"))
          .as("their groceries, Coffee and Personal Care, plus the 30 other defaults")
          .isEqualTo(33);
      for (String name : new String[] {"groceries", "personal care"}) {
        assertThat(
                count(
                    statement,
                    "SELECT count(*) FROM t_category WHERE lower(name) = '"
                        + name
                        + "' AND user_id = '"
                        + USER
                        + "'"))
            .as(name)
            .isEqualTo(1);
      }
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

  private static long count(Statement statement, String sql) throws SQLException {
    try (ResultSet resultSet = statement.executeQuery(sql)) {
      resultSet.next();
      return resultSet.getLong(1);
    }
  }
}
