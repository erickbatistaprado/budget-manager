# Payment methods, banks and accounts

Cards and bank accounts belong to a user. Both record a bank from the shared
Brazilian bank enum; accounts have names unique per user, ignoring case. The
accounts API mirrors cards at `/accounts` and `/accounts/{id}`. Another owner's
card or account returns 404, including when referenced by a transaction write.

Transactions accept nullable `paymentMethod`, `cardId` and `accountId`. Responses
include an account summary (id, name, bank). Unknown methods remain null.
Credit card payments require a card and cannot have an account; they may repeat
monthly (each month in that month's bill) but not daily, weekly or yearly.
Debit card, Pix, transfers, boleto and automatic debit may have an account.
Expenses paid with cash or other cannot have an account. Income supports Pix,
transfers, cash and other; all four may reference an account. This treats the
income-specific account rule as an exception to the general cash/other rule.

`Transaction.validatePayment` validates these combinations. V11 adds CHECK
constraints for method values, card equivalence and account compatibility. A
transaction trigger enforces income-dependent rules because category type lives
in another table and PostgreSQL CHECK expressions cannot query that table.

V11 infers existing card banks from case- and accent-insensitive names, falls back
to OTHER, and marks existing carded transactions CREDIT_CARD. Other transactions
remain unknown. Deleting an account clears only its reference. Deleting a card
clears its reference and payment method together through a database trigger,
preserving bill dates and installments.

Statement imports with a selected card set CREDIT_CARD, including enrichment of
saved purchases. Monthly overrides preserve payment details. Splitting a series
can change them for the selected month and following months.

The `/cards` page manages cards and accounts, with translated bank controls and
subtle brand dots. Transaction forms offer methods appropriate to income,
expense and recurrence, followed by the applicable card or optional account.
Rows show a compact translated payment label. Analytics ranks expenses by method
and by card/account using the existing occurrence projection, including bill
months, installment due dates, skips and per-month overrides. Unknown methods
are grouped as Not set. Card and account names are prefixed in instrument rankings
so identically named instruments remain separate.

Domain tests cover method combinations and monthly overrides. PostgreSQL tests
cover ownership, HTTP validation, persistence, account deletion, monthly series
and migration backfills. Web tests cover labels, payment rankings, conditional
form controls and account deletion confirmation.

## Implementation files

### API

- `apps/api/src/main/java/com/budgetmanager/bm/ledger/application/AccountService.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/application/CardService.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/application/StatementImportService.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/application/TransactionService.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/domain/Account.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/domain/Bank.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/domain/Card.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/domain/PaymentMethod.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/domain/Transaction.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/AccountController.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/AccountDto.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/CardController.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/CardDto.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/TransactionConverter.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/TransactionDto.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/persistence/AccountRepository.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/persistence/TransactionRepository.java`
- `apps/api/src/main/resources/db/migration/V11__payment_methods.sql`
- `apps/api/src/test/java/com/budgetmanager/bm/ledger/application/CardBillIntegrationTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/ledger/application/MonthlyTransactionServiceTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/ledger/application/PaymentMethodIntegrationTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/ledger/domain/PaymentMethodTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/ledger/infrastructure/http/AccountEndpointsTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/ledger/infrastructure/http/CardEndpointsTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/ledger/infrastructure/http/PaymentEndpointsTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/migration/CardsMigrationTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/migration/PaymentMethodsMigrationTest.java`

### Shared client

- `packages/api-client/openapi.yaml`
- `packages/api-client/src/endpoints.ts`
- `packages/api-client/src/generated/index.ts`
- `packages/api-client/src/generated/sdk.gen.ts`
- `packages/api-client/src/generated/types.gen.ts`
- `packages/api-client/src/index.ts`
- `packages/api-client/src/models.ts`

### Web

- `apps/web/src/app/(private)/analytics/page.tsx`
- `apps/web/src/app/(private)/cards/page.test.tsx`
- `apps/web/src/app/(private)/cards/page.tsx`
- `apps/web/src/components/Accounts/AccountsSection.test.tsx`
- `apps/web/src/components/Accounts/AccountsSection.tsx`
- `apps/web/src/components/Bank/Bank.tsx`
- `apps/web/src/components/FinancialMovements/FinancialMovements.component.tsx`
- `apps/web/src/components/NewTransaction/CardSelect.test.tsx`
- `apps/web/src/components/NewTransaction/NewTransaction.component.tsx`
- `apps/web/src/hooks/useAccounts.hook.ts`
- `apps/web/src/i18n/messages/en.ts`
- `apps/web/src/i18n/messages/pt.ts`
- `apps/web/src/types/transaction.type.ts`
- `apps/web/src/utils/payment.util.test.ts`
- `apps/web/src/utils/payment.util.ts`

### Documentation

- `docs/features/payment-methods.md`
