package com.budgetmanager.bm.ledger.application;

import com.budgetmanager.bm.ledger.domain.statement.StatementLine;
import com.budgetmanager.bm.ledger.domain.statement.StatementText;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Decides which statement lines are already saved.
 *
 * <p>A plain line matches a saved transaction with the same date, amount, description and category.
 * Matches are counted, not collapsed: two identical lines and one saved transaction leave one line
 * to import.
 *
 * <p>An installment line matches a saved installment purchase with the same description, number of
 * installments, installment amount and category, whatever its date, because each bill shows the
 * same purchase again with the next installment. Within one file, later lines of a purchase are
 * covered by the first one.
 *
 * <p>Failing that, an installment line still matches a saved purchase with the same purchase date
 * and number of installments when one description starts with the other and the amounts differ by
 * at most a cent per installment. Bills of one bank cut long names at different lengths ({@code
 * ASSOCIACAO CULTURA I} and {@code ASSOCIACAO CULTURA ING}) and put the leftover cents on the first
 * installment, while purchases are saved with them on the last.
 *
 * <p>A matcher is used for one pass over one statement: saved transactions are consumed as lines
 * match them.
 */
final class DuplicateMatcher {

  /** {@code categoryId} is null when matching without a chosen category (preview). */
  record Match(UUID transactionId, Integer sameAsLine, UUID categoryId) {}

  private record PlainKey(LocalDate date, String description, BigDecimal amount) {}

  private record InstallmentKey(String description, int total, BigDecimal amount) {}

  private final Map<PlainKey, List<ExistingTransaction>> plain = new HashMap<>();
  private final Map<InstallmentKey, List<ExistingTransaction>> installments = new HashMap<>();
  private final Map<InstallmentKey, List<FileLine>> installmentsInFile = new HashMap<>();
  private final List<ExistingTransaction> installmentPurchases = new ArrayList<>();

  /** Shortest description prefix trusted to name the same merchant. */
  private static final int MIN_SHARED_PREFIX = 6;

  private static final BigDecimal CENT = new BigDecimal("0.01");

  private record FileLine(int index, UUID categoryId) {}

  DuplicateMatcher(List<ExistingTransaction> existing) {
    for (ExistingTransaction transaction : existing) {
      String description = StatementText.normalize(transaction.notes());
      if (transaction.installmentNumbers() == null) {
        plain
            .computeIfAbsent(
                new PlainKey(transaction.date(), description, money(transaction.totalValue())),
                key -> new ArrayList<>())
            .add(transaction);
      } else {
        installmentPurchases.add(transaction);
        int count = transaction.installmentNumbers();
        BigDecimal total = money(transaction.totalValue());
        BigDecimal regular = total.divide(BigDecimal.valueOf(count), 2, RoundingMode.DOWN);
        BigDecimal last = total.subtract(regular.multiply(BigDecimal.valueOf(count - 1L)));
        for (BigDecimal amount : regular.equals(last) ? List.of(regular) : List.of(regular, last)) {
          installments
              .computeIfAbsent(
                  new InstallmentKey(description, count, amount), key -> new ArrayList<>())
              .add(transaction);
        }
      }
    }
  }

  /**
   * @param categoryId the category the line will be saved with, or null to match any category
   * @return the match, or null when the line is new
   */
  Match match(int index, StatementLine line, UUID categoryId) {
    String description = StatementText.normalize(line.description());
    if (line.isInstallment()) {
      InstallmentKey key =
          new InstallmentKey(description, line.installmentTotal(), money(line.amount()));
      for (ExistingTransaction transaction : savedPurchases(line)) {
        if (categoryId == null || categoryId.equals(transaction.categoryId())) {
          return new Match(transaction.id(), null, transaction.categoryId());
        }
      }
      List<FileLine> earlier =
          installmentsInFile.computeIfAbsent(key, ignored -> new ArrayList<>());
      for (FileLine fileLine : earlier) {
        if (categoryId == null || Objects.equals(categoryId, fileLine.categoryId())) {
          return new Match(null, fileLine.index(), fileLine.categoryId());
        }
      }
      earlier.add(new FileLine(index, categoryId));
      return null;
    }
    PlainKey key = new PlainKey(line.date(), description, money(line.amount()));
    Iterator<ExistingTransaction> candidates = plain.getOrDefault(key, List.of()).iterator();
    while (candidates.hasNext()) {
      ExistingTransaction transaction = candidates.next();
      if (categoryId == null || categoryId.equals(transaction.categoryId())) {
        candidates.remove();
        return new Match(transaction.id(), null, transaction.categoryId());
      }
    }
    return null;
  }

  /**
   * The saved installment purchase a line belongs to, whatever its category. Used for prepaid
   * installments, which move an installment of an existing purchase instead of adding an expense.
   */
  Optional<ExistingTransaction> findPurchase(StatementLine line) {
    if (!line.isInstallment()) {
      return Optional.empty();
    }
    return savedPurchases(line).stream().findFirst();
  }

  /** Saved purchases a line belongs to: exact matches first, then near ones. */
  private List<ExistingTransaction> savedPurchases(StatementLine line) {
    List<ExistingTransaction> found =
        new ArrayList<>(installments.getOrDefault(purchaseKey(line), List.of()));
    String description = StatementText.normalize(line.description());
    for (ExistingTransaction transaction : installmentPurchases) {
      if (!found.contains(transaction) && isNearPurchase(transaction, line, description)) {
        found.add(transaction);
      }
    }
    return found;
  }

  private static boolean isNearPurchase(
      ExistingTransaction transaction, StatementLine line, String description) {
    int count = line.installmentTotal();
    if (transaction.installmentNumbers() != count || !line.date().equals(transaction.date())) {
      return false;
    }
    BigDecimal saved =
        money(transaction.totalValue()).divide(BigDecimal.valueOf(count), 2, RoundingMode.DOWN);
    BigDecimal tolerance = CENT.multiply(BigDecimal.valueOf(count));
    if (saved.subtract(money(line.amount())).abs().compareTo(tolerance) > 0) {
      return false;
    }
    String savedDescription = StatementText.normalize(transaction.notes());
    String shorter =
        savedDescription.length() <= description.length() ? savedDescription : description;
    String longer = shorter.equals(savedDescription) ? description : savedDescription;
    return shorter.length() >= MIN_SHARED_PREFIX && longer.startsWith(shorter);
  }

  /** Lines with equal keys are installments of the same purchase. */
  static Object purchaseKey(StatementLine line) {
    return new InstallmentKey(
        StatementText.normalize(line.description()), line.installmentTotal(), money(line.amount()));
  }

  private static BigDecimal money(BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP);
  }
}
