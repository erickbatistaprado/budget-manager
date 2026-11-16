package com.budgetmanager.bm.identity.infrastructure.persistence;

import com.budgetmanager.bm.identity.domain.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
  @EntityGraph(attributePaths = "roles")
  Optional<User> findByEmail(String email);

  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query(
      "select accountOwner from User accountOwner where accountOwner.id = :id")
  Optional<User> lockById(java.util.UUID id);
}
