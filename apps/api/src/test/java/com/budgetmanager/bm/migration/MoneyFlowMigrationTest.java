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
class MoneyFlowMigrationTest {
  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void existingSavingsBecomeOpeningContributionsAndCardsHaveNoPaymentAccounts() throws Exception {
    var configuration =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .placeholders(
                Map.of("seed_user_email", "", "seed_user_name", "", "seed_user_password_hash", ""));
    configuration.target("12").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement()) {
      statement.execute(
          "INSERT INTO t_user(id,email,password) VALUES ('00000000-0000-0000-0000-000000000013','migration@example.com','hash')");
      statement.execute(
          "INSERT INTO t_saving(id,user_id,name,amount,location,created_at) VALUES ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000013','Reserve',250,'SAVINGS_ACCOUNT','2026-01-01T12:00:00Z')");
      statement.execute(
          "INSERT INTO t_card(id,user_id,name,bank,closing_day,due_day) VALUES ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000013','Card','OTHER',25,5)");
    }
    configuration.target("14").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement()) {
      try (var result =
          statement.executeQuery(
              "SELECT kind,date,amount,opening,from_account_id FROM t_movement")) {
        assertThat(result.next()).isTrue();
        assertThat(result.getString(1)).isEqualTo("INVESTMENT");
        assertThat(result.getDate(2).toString()).isEqualTo("2026-01-01");
        assertThat(result.getBigDecimal(3)).isEqualByComparingTo("250");
        assertThat(result.getBoolean(4)).isTrue();
        assertThat(result.getObject(5)).isNull();
        assertThat(result.next()).isFalse();
      }
      try (var result =
          statement.executeQuery("SELECT payment_account_id,funding_account_id FROM t_card")) {
        assertThat(result.next()).isTrue();
        assertThat(result.getObject(1)).isNull();
        assertThat(result.getObject(2)).isNull();
      }
    }
  }
}
