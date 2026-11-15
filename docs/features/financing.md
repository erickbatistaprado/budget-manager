# Financing (financiamentos)

Status: phases 1 and 2 implemented; Docker-backed verification pending.

Car and house loans do not behave like card installments, so they get their own feature instead
of a 48× installment purchase:

- Payments are not equal. Brazilian contracts use SAC (falling payments) or Price (fixed
  payments), are often corrected by TR or IPCA, and add insurance and fees to each payment.
- Paying ahead is different. An extra payment (amortização extraordinária) lowers the
  outstanding balance and removes the interest of the skipped installments; the borrower chooses
  to reduce the term or the payment. Moving installments to an earlier date, as card prepayment
  does, would overstate what was paid.
- What matters is different: outstanding balance (saldo devedor), interest paid and still to
  pay, payoff date, and what an extra payment saves.

## Goals

1. Register a contract and see its full amortization schedule: principal, interest, insurance and
   fees per installment, outstanding balance after each one.
2. Record extra payments that reduce the term or the payment, with a simulation before saving.
3. Keep the schedule matching the bank: record what was actually paid and, when the bank's
   statement shows it, the real outstanding balance.
4. Count payments as expenses everywhere (Home, Analytics, spending room) with no special cases.

Not in scope at first: fetching TR/IPCA automatically, consórcio, credit card revolving debt,
personal loans with irregular payments.

## Calculation

Monthly rate `i` from the contract's effective annual rate `a`: `i = (1 + a)^(1/12) - 1`. When a
contract states a monthly rate, use it directly. Balance `B0`, term `n`.

- Price: `PMT = B0 · i / (1 - (1 + i)^-n)`. For each installment, `interest = B · i`,
  `principal = PMT - interest`, `B = B - principal`.
- SAC: `principal = B0 / n` (constant). For each installment, `interest = B · i`,
  `payment = principal + interest`.
- Each installment adds fixed monthly costs from the contract: insurance (MIP, DFI) and an
  administration fee. They can be overridden per installment.
- Money is rounded to cents per installment, and the last installment absorbs the difference so
  principal adds up exactly to the amount financed.

Extra payment of `A` on a date, applied after the installment due on or before it:

- `B = B - A`.
- Reduce term: keep `PMT` (Price) or the constant principal (SAC) and recalculate how many
  installments remain; the last one may be smaller.
- Reduce payment: keep the remaining count and recalculate `PMT` (Price) or the principal
  (`B / remaining`, SAC).
- Savings = remaining interest before minus remaining interest after. The simulation shows it
  for both options before anything is saved.

Correction (TR/IPCA), first version: no index data. Two manual tools keep the schedule honest:

- Record the amount actually paid for an installment (from the bank or the statement).
- Sync the outstanding balance with the bank's value on a date; the remaining schedule is
  recalculated from it with the same rate and remaining count.

Later, optionally: monthly TR/IPCA from the Banco Central public API (series data only, nothing
from the user is sent).

## Model

New bounded context `financing` (domain, application, infrastructure), following the
architecture guide.

- `Financing`: owner, name, kind (`REAL_ESTATE`, `VEHICLE`, `OTHER`), lender, system (`SAC`,
  `PRICE`), amount financed, down payment (for information), rate (annual or monthly), term,
  first due date, monthly insurance and fees, correction index (`NONE`, `TR`, `IPCA`,
  informational at first), expense category.
- `FinancingInstallment`: number, due date, principal, interest, insurance, fees, payment,
  balance after, status (`SCHEDULED`, `PAID`), amount actually paid.
- `ExtraPayment`: date, amount, option (`REDUCE_TERM`, `REDUCE_PAYMENT`), interest saved.
- `BalanceSync`: date, balance reported by the bank.

The schedule is derived: domain code rebuilds it from the contract, extra payments and balance
syncs, so recalculation is deterministic and testable. Paid installments are never rewritten.

## Link to expenses

Each financing owns one ledger transaction (an installment purchase in the expense category the
user picks), so Home, Analytics, the spending room and statement imports keep working without a
second source of expenses:

- Its installments mirror the schedule's payments, with their real, unequal amounts.
- The transaction is marked as managed by a financing (`source = FINANCING`, `financingId`). The
  ledger does not regenerate its installments and refuses direct edits; changes go through the
  financing.
- The financing context calls a ledger application interface to create and update it, never the
  ledger repositories.
- An extra payment appears as its own expense on the payment day (the money did leave), and the
  managed installments shrink or disappear accordingly.

Needed in the ledger: installments with explicit amounts (today they are always total ÷ count),
the managed flag, and a guard in edit, delete and pay-early.

## API

- `GET/POST /financings`, `GET/PUT/DELETE /financings/{id}`
- `GET /financings/{id}/schedule`
- `POST /financings/{id}/extra-payments/simulate` and `POST /financings/{id}/extra-payments`
- `POST /financings/{id}/installments/{number}/paid` (amount actually paid)
- `POST /financings/{id}/balance-syncs`

All owner-scoped, documented in `packages/api-client/openapi.yaml`.

## Web

- Menu > Financing: list of contracts with outstanding balance, next payment and payoff date.
- Contract page: summary (balance, interest paid and remaining, progress), balance over time,
  principal vs interest per installment, and the schedule table (paid rows marked).
- New contract form with a live preview of the first payments and the totals.
- Extra payment dialog: amount and date, then both options side by side (new term or new
  payment, interest saved) before confirming.
- Record a paid amount from the schedule row; "Sync balance with the bank".
- English and Portuguese: financiamento, saldo devedor, amortização, juros, prazo, parcela,
  amortização extraordinária, reduzir prazo, reduzir parcela, sistema SAC/Price, seguro (MIP,
  DFI), taxa de administração, correção (TR, IPCA).
- Analytics: a debt card (total outstanding, interest paid this year), and financing payments
  already count in the spending room through the managed transaction.

## Tests

- Price and SAC schedules against figures from bank simulators (Caixa for SAC, a vehicle CDC for
  Price), including rounding and the last installment.
- Extra payments: both options, several in a row, one on the last installments, savings.
- Balance sync and paid amounts recalculating only the future.
- Ledger: managed transactions keep their amounts and refuse direct edits.
- Migration tests for the new tables and the ledger columns; HTTP tests for ownership.
- Web: calculation helpers, the simulation dialog, both languages.

## Phases

1. Contracts, Price and SAC schedules, the managed expense transaction, contract page.
2. Extra payments with simulation, paid amounts, balance sync.
3. Analytics debt card; optional TR/IPCA from the Banco Central; mobile.

## Open questions

- Which contracts first: house (SFH/SFI, usually SAC with TR) or car (CDC, usually Price)?
- Does the bank's statement or app show the outstanding balance, so balance sync can be routine?
- Should TR/IPCA be fetched automatically later, or is manual sync enough?

## Implemented phases 1 and 2

The API, shared client and web now include car and property contracts, SAC and Price schedules,
extra-payment simulations and confirmation, actual installment payments, bank balance syncs,
and due-day changes. Phase 3 remains out of scope: no Analytics debt card, automatic TR/IPCA,
or mobile feature is included.

### Calculation and history

`financing/domain/Amortization` is independent of Spring and persistence. Money uses BigDecimal,
HALF_UP cents, and a final principal adjustment. Rates are decimal fractions (`0.015` means 1.5%
monthly). Drafts accept a monthly rate, or an annual effective rate when monthlyRate is omitted.
A stated Price installment means principal plus interest, before monthly insurance and fees.
Bisection derives its effective monthly rate; responses show this alongside the quoted rate.
R$50,000 at 1.5% over 36 months gives R$1,807.62; R$1,815 implies a higher effective rate.

The domain `Financing` aggregate stores terms as columns in `t_financing` and ordered
`FinancingChange` children in `t_financing_change`. Its schedule is never stored: `schedule()`
replays changes through the unchanged amortization engine. No JSON mapping is used. Optimistic versioning protects concurrent updates. Financial
adjustments apply after installments due on or before their date and preserve those rows;
recalculating a future paid row is refused. Dated balance adjustments must be chronological.
Metadata may be edited, but changing financial terms after payment or adjustment history exists
is refused. Recording an actual paid amount changes the ledger expense, not the principal split:
use a bank balance sync when the actual outstanding principal differs.

Due-day changes preserve amounts and clamp short months independently. Moving 28 to 7 starting
at installment 11 due November 28 moves it to December 7 and subsequent dates to January 7, etc.
The original financed amount alone is amortized; purchase price, down payment, IOF, registration
and valuation fee are informational costs. Creation accepts an already-paid count; omitted means
all installments due strictly before the server's current date.

### Ledger and HTTP

`ledger/application/FinancingLedgerService` is the cross-context application boundary. It mirrors
explicit schedule amounts and dates into existing `t_installment` rows and records extra payments
as separate same-day expenses. Actual paid amounts replace the corresponding ledger amount.
V12 adds `source = FINANCING` and `financing_id`; ordinary purchases retain equal division and
last-installment cents. Normal edit, delete, early-payment/restore and monthly routes reject
financing-owned expenses with an instruction to manage the financing. Web expense rows link to
the contract. Month listings continue to query installment due dates.

`TransactionRepository.findImportCandidates` excludes all financing-owned expenses. A future
boleto reconciliation should use a separate financing-installment matcher before purchase
matching in `StatementImportService`; purchase duplicate matching must continue to exclude them.

The routes listed above are implemented, plus `POST /financings/preview` (no writes) and
`POST /financings/{id}/due-day-changes` (`fromInstallment`, `dueDay`). All contract routes enforce
ownership with 404s. API dates use `yyyy/MM/dd`; request drafts do not contain response-only
primitive fields. The OpenAPI specification, generated SDK and handwritten client are updated.

### Web and validation

`/financings`, `/financings/new`, and `/financings/[id]` provide the list, live server preview,
contract costs and rate summary, outstanding/paid/interest/progress cards, MUI balance and payment
composition charts with custom legends, a horizontally scrollable schedule, and adjustment forms.
Extra payments display both simulations before confirmation. Strings are English and Brazilian
Portuguese, and controls follow the cards/transaction panel styles.

Domain tests cover both systems, stated and computed Price, zero rates, rounding, repeated and
near-payoff extras, bank sync, paid amounts, due-day changes and deterministic history replay.
Testcontainers coverage was added for migration, already-paid creation, explicit ledger amounts,
listing, direct-edit guards, preview/request parsing and ownership. Docker is inaccessible in this
sandbox, so these integration tests still need a Docker-enabled run.

Persistence redesign validation: API unit tests and `ArchitectureTest` pass (185 tests run,
zero failures/errors, one optional local-statement test skipped), together with PMD, Spotless
and SpotBugs. Mockito was supplied as a JVM agent because sandbox attachment is blocked.
Docker-backed tests remain excluded here; financing integration assertions now reload the
aggregate and verify ordered history/schedule replay, and sign in again after MockMvc requests.
The HTTP shapes, web and client are unchanged by this redesign.

The shared-client check passes. API domain tests and PMD/Spotless/SpotBugs checks pass. Web tests
(186 tests), lint and TypeScript checks pass with a temporary external preload that reads the
TypeScript configuration through its API, plus `--watchman=false`; the sandbox returns empty
output from Next.js's TypeScript child process and prevents Watchman's runtime directory writes.
The production build also succeeds with that external preload. Neither workaround changes
repository configuration or dependencies; ordinary `npm run check` / `npm run build` should be
rerun outside this sandbox along with full `./mvnw verify`.

## Implementation files

- `apps/api/src/main/java/com/budgetmanager/bm/financing/application/FinancingService.java`
- `apps/api/src/main/java/com/budgetmanager/bm/financing/domain/Amortization.java`
- `apps/api/src/main/java/com/budgetmanager/bm/financing/infrastructure/http/FinancingController.java`
- `apps/api/src/main/java/com/budgetmanager/bm/financing/domain/Financing.java`
- `apps/api/src/main/java/com/budgetmanager/bm/financing/domain/FinancingChange.java`
- `apps/api/src/main/java/com/budgetmanager/bm/financing/infrastructure/persistence/FinancingRepository.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/application/FinancingLedgerService.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/application/TransactionService.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/domain/Transaction.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/TransactionConverter.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/http/TransactionDto.java`
- `apps/api/src/main/java/com/budgetmanager/bm/ledger/infrastructure/persistence/TransactionRepository.java`
- `apps/api/src/main/resources/db/migration/V12__financing.sql`
- `apps/api/src/test/java/com/budgetmanager/bm/financing/domain/AmortizationTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/financing/domain/FinancingTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/financing/infrastructure/http/FinancingIntegrationTest.java`
- `apps/api/src/test/java/com/budgetmanager/bm/migration/FinancingMigrationTest.java`
- `apps/web/src/app/(private)/financings/[id]/page.tsx`
- `apps/web/src/app/(private)/financings/new/page.tsx`
- `apps/web/src/app/(private)/financings/page.tsx`
- `apps/web/src/components/FinancialMovements/FinancialMovements.component.tsx`
- `apps/web/src/components/Financing/ExtraPaymentDialog.test.tsx`
- `apps/web/src/components/Financing/ExtraPaymentDialog.tsx`
- `apps/web/src/components/Financing/styles.ts`
- `apps/web/src/components/SideMenu/SideMenu.component.tsx`
- `apps/web/src/i18n/messages/en.ts`
- `apps/web/src/i18n/messages/pt.ts`
- `apps/web/src/types/transaction.type.ts`
- `apps/web/src/utils/financing.util.test.ts`
- `apps/web/src/utils/financing.util.ts`
- `docs/features/financing.md`
- `packages/api-client/openapi.yaml`
- `packages/api-client/src/endpoints.ts`
- `packages/api-client/src/financing.ts`
- `packages/api-client/src/generated/index.ts`
- `packages/api-client/src/generated/sdk.gen.ts`
- `packages/api-client/src/generated/types.gen.ts`
- `packages/api-client/src/index.ts`
- `packages/api-client/src/models.ts`
