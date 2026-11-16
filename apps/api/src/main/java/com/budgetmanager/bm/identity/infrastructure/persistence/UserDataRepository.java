package com.budgetmanager.bm.identity.infrastructure.persistence;

import com.budgetmanager.bm.identity.application.UserDataService.Summary;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.ObjectReader;

/** Each section declares its ownership query; child records are scoped through their parent. */
@Repository
public class UserDataRepository {
  private static final Map<String, String> SECTIONS =
      new TreeMap<>(
          Map.ofEntries(
              Map.entry(
                  "profile",
                  "SELECT id, name, email, salary_day, created_at, updated_at FROM t_user WHERE id = :owner"),
              Map.entry("categories", "SELECT * FROM t_category WHERE user_id = :owner"),
              Map.entry("transactions", "SELECT * FROM t_transaction WHERE user_id = :owner"),
              Map.entry(
                  "installments",
                  "SELECT child.* FROM t_installment child JOIN t_transaction parent ON parent.id = child.transaction_id WHERE parent.user_id = :owner"),
              Map.entry(
                  "monthlyOverrides",
                  "SELECT child.* FROM t_transaction_month child JOIN t_transaction parent ON parent.id = child.transaction_id WHERE parent.user_id = :owner"),
              Map.entry("cards", "SELECT * FROM t_card WHERE user_id = :owner"),
              Map.entry("accounts", "SELECT * FROM t_account WHERE user_id = :owner"),
              Map.entry("savings", "SELECT * FROM t_saving WHERE user_id = :owner"),
              Map.entry("financings", "SELECT * FROM t_financing WHERE user_id = :owner"),
              Map.entry(
                  "financingChanges",
                  "SELECT child.* FROM t_financing_change child JOIN t_financing parent ON parent.id = child.financing_id WHERE parent.user_id = :owner"),
              Map.entry("movements", "SELECT * FROM t_movement WHERE user_id = :owner"),
              Map.entry(
                  "accountBalances",
                  "SELECT child.* FROM t_account_balance child JOIN t_account parent ON parent.id = child.account_id WHERE parent.user_id = :owner"),
              Map.entry(
                  "savingValuations",
                  "SELECT child.* FROM t_saving_valuation child JOIN t_saving parent ON parent.id = child.saving_id WHERE parent.user_id = :owner")));

  private final JdbcClient jdbc;
  private final ObjectReader reader;
  private final long maxProfileImageBytes;

  public UserDataRepository(
      JdbcClient jdbc,
      ObjectMapper mapper,
      @Value("${app.uploads.max-profile-image-bytes}") long maxProfileImageBytes) {
    this.jdbc = jdbc;
    this.reader =
        mapper
            .readerFor(new TypeReference<java.util.List<Map<String, Object>>>() {})
            .with(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
    this.maxProfileImageBytes = maxProfileImageBytes;
  }

  public Summary summary(UUID owner) {
    return jdbc.sql(
            "SELECT min(date) AS first_date, count(*) AS entries FROM t_transaction WHERE user_id = :owner")
        .param("owner", owner)
        .query((result, rowNumber) ->
            new Summary(
                result.getObject("first_date", LocalDate.class),
                result.getLong("entries"),
                maxProfileImageBytes))
        .single();
  }

  public Map<String, Object> export(UUID owner) {
    Map<String, Object> sections = new LinkedHashMap<>();
    SECTIONS.forEach((name, query) -> {
      String json =
          jdbc.sql(
                  "SELECT coalesce(jsonb_agg(to_jsonb(section) ORDER BY section.id), '[]'::jsonb)::text FROM ("
                      + query
                      + ") section")
              .param("owner", owner)
              .query(String.class)
              .single();
      sections.put(name, reader.readValue(json));
    });
    return sections;
  }
}
