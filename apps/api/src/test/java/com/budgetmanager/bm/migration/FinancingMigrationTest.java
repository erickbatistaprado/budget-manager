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
class FinancingMigrationTest {
  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void migratesExistingPurchasesWithoutChangingAmounts() throws Exception {
    var configuration =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .placeholders(
                Map.of("seed_user_email", "", "seed_user_name", "", "seed_user_password_hash", ""));
    configuration.target("11").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement()) {
      statement.execute(
          "INSERT INTO t_user(id,email,password) VALUES ('00000000-0000-0000-0000-000000000012','migration@example.com','hash')");
      statement.execute(
          "INSERT INTO t_category(id,user_id,name,transaction_type) VALUES ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000012','Car','EXPENSE')");
      statement.execute(
          "INSERT INTO t_transaction(id,user_id,category_id,total_value,date,repeats) VALUES ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000012',100,'2026-01-01','NONE')");
    }
    configuration.target("12").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement();
        var result =
            statement.executeQuery("SELECT source, financing_id, total_value FROM t_transaction")) {
      assertThat(result.next()).isTrue();
      assertThat(result.getString(1)).isEqualTo("MANUAL");
      assertThat(result.getObject(2)).isNull();
      assertThat(result.getBigDecimal(3)).isEqualByComparingTo("100");
    }
  }
}
