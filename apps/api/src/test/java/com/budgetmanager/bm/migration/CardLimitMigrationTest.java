package com.budgetmanager.bm.migration;

import static org.assertj.core.api.Assertions.*;

import com.budgetmanager.bm.support.PostgresContainerConfiguration;
import java.sql.DriverManager;
import java.util.Map;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
class CardLimitMigrationTest {
  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void existingCardsHaveNoLimit() throws Exception {
    var configuration =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .placeholders(
                Map.of("seed_user_email", "", "seed_user_name", "", "seed_user_password_hash", ""));
    configuration.target("14").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement()) {
      statement.execute(
          "INSERT INTO t_user(id,email,password) VALUES ('00000000-0000-0000-0000-000000000013','migration@example.com','hash')");
      statement.execute(
          "INSERT INTO t_card(id,user_id,name,bank,closing_day,due_day) VALUES ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000013','Card','OTHER',25,5)");
    }
    configuration.target("15").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement()) {
      try (var result = statement.executeQuery("SELECT credit_limit FROM t_card")) {
        assertThat(result.next()).isTrue();
        assertThat(result.getBigDecimal(1)).isNull();
      }
      assertThatThrownBy(() -> statement.execute("UPDATE t_card SET credit_limit = 0"))
          .isInstanceOf(java.sql.SQLException.class);
    }
  }
}
