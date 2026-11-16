package com.budgetmanager.bm.ledger.infrastructure.persistence;

import com.budgetmanager.bm.ledger.application.ExistingTransaction;
import com.budgetmanager.bm.ledger.application.PaidEarlyInstallment;
import com.budgetmanager.bm.ledger.domain.Transaction;
import com.budgetmanager.bm.ledger.domain.TransactionType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {
  @Query(
      "SELECT DISTINCT t FROM Transaction t JOIN FETCH t.category LEFT JOIN FETCH t.account LEFT JOIN FETCH t.card LEFT JOIN FETCH t.installments WHERE t.user.id = :userId")
  List<Transaction> findMoneyFlowData(UUID userId);

  @Query("SELECT DISTINCT t FROM Transaction t LEFT JOIN FETCH t.months WHERE t.user.id = :userId")
  List<Transaction> loadMoneyFlowMonths(UUID userId);

  @Query(
      "SELECT DISTINCT t FROM Transaction t JOIN FETCH t.category JOIN FETCH t.card LEFT JOIN FETCH t.months WHERE t.user.id = :userId AND t.repeats = 'MONTHLY' AND t.financingId IS NULL")
  List<Transaction> findCardSubscriptions(UUID userId);

  Optional<Transaction> findByIdAndUserId(UUID id, UUID userId);

  List<Transaction> findByFinancingId(UUID financingId);

  // Financing boleto reconciliation belongs in a dedicated installment matcher, before purchase
  // matching.
  @Query(
      """
          SELECT new com.budgetmanager.bm.ledger.application.ExistingTransaction(
            t.id, t.notes, t.date, t.totalValue, t.installmentNumbers, c.id, c.transactionType,
            t.createdAt)
          FROM Transaction t
          JOIN t.category c
          WHERE t.user.id = :userId AND t.notes IS NOT NULL AND t.financingId IS NULL AND (t.repeats IS NULL OR t.repeats <> 'MONTHLY')
      """)
  List<ExistingTransaction> findImportCandidates(@Param("userId") UUID userId);

  @Query(
      """
          SELECT new com.budgetmanager.bm.ledger.application.PaidEarlyInstallment(
            t.id, i.installmentNumber, i.dueDate)
          FROM Installment i
          JOIN i.transaction t
          WHERE t.user.id = :userId AND i.paidEarly = true
      """)
  List<PaidEarlyInstallment> findPaidEarlyInstallments(@Param("userId") UUID userId);

  @Query(
      value =
          """
              SELECT t.id
              FROM Transaction t
              WHERE t.user.id = :userId
                AND t.category.transactionType = :type
                AND (
                        (
                            t.installmentNumbers IS NULL
                            AND (
                                (t.repeats <> 'NONE'
                                  AND (t.date <= :endDate OR (t.repeats = 'MONTHLY' AND t.date <= :lastDayOfEndMonth))
                                  AND (t.repeatUntil IS NULL OR t.repeatUntil >= :firstDayOfStartMonth)) OR
                                ((t.repeats = 'NONE' OR t.repeats IS NULL) AND COALESCE(t.billDueDate, t.date) BETWEEN :startDate AND :endDate)
                            )
                        )
                        OR
                        (
                            t.installmentNumbers IS NOT NULL
                            AND EXISTS (
                                SELECT 1
                                FROM Installment i
                                WHERE i.transaction = t
                                  AND i.dueDate BETWEEN :startDate AND :endDate
                            )
                        )
                )
              ORDER BY
                CASE WHEN :sortKey = 'category' AND :sortOrder = 'asc' THEN LOWER(t.category.name) END ASC,
                CASE WHEN :sortKey = 'category' AND :sortOrder = 'desc' THEN LOWER(t.category.name) END DESC,
                CASE WHEN :sortKey = 'notes' AND :sortOrder = 'asc' THEN LOWER(COALESCE(t.notes, '')) END ASC,
                CASE WHEN :sortKey = 'notes' AND :sortOrder = 'desc' THEN LOWER(COALESCE(t.notes, '')) END DESC,
                CASE WHEN :sortKey = 'date' AND :sortOrder = 'asc' THEN t.date END ASC,
                CASE WHEN :sortKey = 'date' AND :sortOrder = 'desc' THEN t.date END DESC,
                CASE
                    WHEN :sortKey = 'value'
                      AND :sortOrder = 'asc'
                      AND t.installmentNumbers IS NULL
                    THEN t.totalValue
                    WHEN :sortKey = 'value'
                      AND :sortOrder = 'asc'
                      AND t.installmentNumbers IS NOT NULL
                    THEN t.totalValue / t.installmentNumbers
                END ASC,
                CASE
                    WHEN :sortKey = 'value'
                      AND :sortOrder = 'desc'
                      AND t.installmentNumbers IS NULL
                    THEN t.totalValue
                    WHEN :sortKey = 'value'
                      AND :sortOrder = 'desc'
                      AND t.installmentNumbers IS NOT NULL
                    THEN t.totalValue / t.installmentNumbers
                END DESC,
                t.id DESC
          """,
      countQuery =
          """
              SELECT COUNT(t.id)
              FROM Transaction t
              WHERE t.user.id = :userId
                AND t.category.transactionType = :type
                AND (
                        (
                            t.installmentNumbers IS NULL
                            AND (
                                (t.repeats <> 'NONE'
                                  AND (t.date <= :endDate OR (t.repeats = 'MONTHLY' AND t.date <= :lastDayOfEndMonth))
                                  AND (t.repeatUntil IS NULL OR t.repeatUntil >= :firstDayOfStartMonth)) OR
                                ((t.repeats = 'NONE' OR t.repeats IS NULL) AND COALESCE(t.billDueDate, t.date) BETWEEN :startDate AND :endDate)
                            )
                        )
                        OR
                        (
                            t.installmentNumbers IS NOT NULL
                            AND EXISTS (
                                SELECT 1
                                FROM Installment i
                                WHERE i.transaction = t
                                  AND i.dueDate BETWEEN :startDate AND :endDate
                            )
                        )
                )
          """)
  Page<UUID> findIdsByUserAndTypeAndDateBetween(
      @Param("userId") UUID userId,
      @Param("type") TransactionType type,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate,
      @Param("firstDayOfStartMonth") LocalDate firstDayOfStartMonth,
      @Param("lastDayOfEndMonth") LocalDate lastDayOfEndMonth,
      @Param("sortKey") String sortKey,
      @Param("sortOrder") String sortOrder,
      Pageable pageable);

  @Query(
      """
          SELECT DISTINCT t
          FROM Transaction t
          JOIN FETCH t.category c
          LEFT JOIN FETCH t.account
          LEFT JOIN FETCH t.card
          LEFT JOIN FETCH t.installments i
          WHERE t.id IN :ids
      """)
  List<Transaction> findAllWithCategoryAndInstallmentsByIdIn(@Param("ids") List<UUID> ids);
}
