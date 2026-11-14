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
class CategoryOwnershipMigrationTest {

  private static final String ALICE = "00000000-0000-0000-0000-00000000a11c";
  private static final String BOB = "00000000-0000-0000-0000-000000000b0b";
  private static final String SHARED_FOOD = "00000000-0000-0000-0000-00000000f00d";
  private static final String UNUSED = "00000000-0000-0000-0000-0000000000ff";

  @Container
  private static final PostgreSQLContainer POSTGRES =
      new PostgreSQLContainer(PostgresContainerConfiguration.POSTGRES_IMAGE);

  @Test
  void sharedCategoriesAreCopiedToEveryUserAndTransactionsFollowTheirOwner() throws Exception {
    flyway("2").migrate();
    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      statement.execute(
          """
          INSERT INTO t_user (id, email, password) VALUES
            ('%1$s', 'alice@example.com', 'hash'),
            ('%2$s', 'bob@example.com', 'hash');
          INSERT INTO t_category (id, name, transaction_type) VALUES
            ('%3$s', 'Food', 'EXPENSE'),
            ('%4$s', 'Unused', 'INCOME');
          INSERT INTO t_transaction (id, date, total_value, category_id, user_id, repeats) VALUES
            (gen_random_uuid(), '2026-01-01', 10.00, '%3$s', '%1$s', 'NONE'),
            (gen_random_uuid(), '2026-01-02', 20.00, '%3$s', '%2$s', 'NONE');
          INSERT INTO t_refresh_token (id, token, user_id, expiry_date) VALUES
            (gen_random_uuid(), 'plain-text-token', '%1$s', now() + interval '1 day');
          """
              .formatted(ALICE, BOB, SHARED_FOOD, UNUSED));
    }

    flyway("3").migrate();

    try (Connection connection = connect();
        Statement statement = connection.createStatement()) {
      assertThat(count(statement, "SELECT count(*) FROM t_category WHERE user_id IS NULL"))
          .isZero();
      assertThat(
              count(statement, "SELECT count(*) FROM t_category WHERE user_id = '" + ALICE + "'"))
          .isEqualTo(2);
      assertThat(count(statement, "SELECT count(*) FROM t_category WHERE user_id = '" + BOB + "'"))
          .isEqualTo(2);
      assertThat(
              count(statement, "SELECT count(*) FROM t_category WHERE id = '" + SHARED_FOOD + "'"))
          .isZero();
      assertThat(
              count(
                  statement,
                  """
                  SELECT count(*)
                  FROM t_transaction t
                  JOIN t_category c ON c.id = t.category_id
                  WHERE c.user_id <> t.user_id
                  """))
          .isZero();
      assertThat(count(statement, "SELECT count(*) FROM t_transaction")).isEqualTo(2);
      assertThat(count(statement, "SELECT count(*) FROM t_refresh_token")).isZero();
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
