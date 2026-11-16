package com.budgetmanager.bm.savings.infrastructure.persistence;

import com.budgetmanager.bm.savings.domain.Saving;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavingRepository extends JpaRepository<Saving, UUID> {
  List<Saving> findAllByUserIdOrderByLocationAscNameAsc(UUID userId);

  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query(
      "SELECT saving FROM Saving saving WHERE saving.id = :id AND saving.user.id = :userId")
  Optional<Saving> lockByIdAndUserId(UUID id, UUID userId);

  Optional<Saving> findByIdAndUserId(UUID id, UUID userId);
}
