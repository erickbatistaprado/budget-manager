package com.budgetmanager.bm.identity.infrastructure.persistence;

import com.budgetmanager.bm.identity.domain.RefreshToken;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

  @Query(
      """
          SELECT r
          FROM RefreshToken r
          JOIN FETCH r.user u
          LEFT JOIN FETCH u.roles
          WHERE r.tokenHash = :tokenHash
      """)
  Optional<RefreshToken> findWithUserByTokenHash(@Param("tokenHash") String tokenHash);

  /**
   * Swaps an unexpired token for a new one in a single statement. Two requests racing with the same
   * token cannot both succeed: the second one sees the new hash and updates no row.
   */
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query(
      """
          UPDATE RefreshToken r
          SET r.tokenHash = :newTokenHash, r.expiryDate = :expiryDate, r.updatedAt = :now
          WHERE r.tokenHash = :oldTokenHash AND r.expiryDate > :now
      """)
  int rotate(
      @Param("oldTokenHash") String oldTokenHash,
      @Param("newTokenHash") String newTokenHash,
      @Param("expiryDate") Instant expiryDate,
      @Param("now") Instant now);

  @Modifying
  @Query("DELETE FROM RefreshToken r WHERE r.tokenHash = :tokenHash")
  int deleteByTokenHash(@Param("tokenHash") String tokenHash);

  @Modifying
  @Query("DELETE FROM RefreshToken r WHERE r.user.id = :userId")
  int deleteAllByUserId(@Param("userId") UUID userId);

  @Modifying
  @Query("DELETE FROM RefreshToken r WHERE r.user.id = :userId AND r.expiryDate <= :now")
  int deleteExpiredByUserId(@Param("userId") UUID userId, @Param("now") Instant now);
}
