package com.budgetmanager.bm.identity.application;

import com.budgetmanager.bm.identity.infrastructure.persistence.UserDataRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserDataService {
  private final UserService users;
  private final UserDataRepository repository;
  private final Clock clock;

  public record Summary(LocalDate firstEntryDate, long entryCount, long maxProfileImageBytes) {}

  public record Backup(int version, Instant exportedAt, Map<String, Object> sections) {
    public Backup {
      sections = java.util.Collections.unmodifiableMap(new LinkedHashMap<>(sections));
    }
  }

  @Transactional(readOnly = true)
  public Summary summary() {
    return repository.summary(users.requireCurrentUser().getId());
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Backup export() {
    return new Backup(1, clock.instant(), repository.export(users.requireCurrentUser().getId()));
  }
}
