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
class GoalsMigrationTest {
  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void addsGoalTablesAndNullableUserPreferencesAndClearsMainAccountOnDelete() throws Exception {
    var configuration =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .placeholders(
                Map.of("seed_user_email", "", "seed_user_name", "", "seed_user_password_hash", ""));
    configuration.target("16").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement()) {
      statement.execute(
          "INSERT INTO t_user(id,email,password) VALUES ('00000000-0000-0000-0000-000000000017','migration@example.com','hash')");
      statement.execute(
          "INSERT INTO t_account(id,user_id,name,bank) VALUES ('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000017','Checking','OTHER')");
    }
    configuration.target("17").load().migrate();
    try (var connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = connection.createStatement()) {
      try (var result =
          statement.executeQuery("SELECT main_account_id, goal_monthly_pace FROM t_user")) {
        assertThat(result.next()).isTrue();
        assertThat(result.getObject(1)).isNull();
        assertThat(result.getBigDecimal(2)).isNull();
      }
      statement.execute(
          "UPDATE t_user SET main_account_id = '00000000-0000-0000-0000-000000000017'");
      statement.execute("DELETE FROM t_account WHERE id = '00000000-0000-0000-0000-000000000017'");
      try (var result = statement.executeQuery("SELECT main_account_id FROM t_user")) {
        assertThat(result.next()).isTrue();
        assertThat(result.getObject(1)).isNull();
      }
      assertThatThrownBy(() ->
              statement.execute(
                  "INSERT INTO t_goal(id,user_id,name,price,kind,position,status) VALUES ('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000017','Invalid',0,'WANT',1,'ACTIVE')"))
          .isInstanceOf(java.sql.SQLException.class);
    }
  }
}
