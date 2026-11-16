# Money flow

Movements track money between accounts, card bills and savings. They are separate
from transactions and never enter income/expense totals, categories or Analytics.
Home uses the overview endpoints for its monthly summary, account balances, bills
and evolution, alongside a unified searchable transaction and movement list.

## Ledger and automatic bills

V14 introduces movements, account balance checkpoints, saving valuations, and card
payment/funding accounts. Domain rules and database CHECK constraints enforce:

- TRANSFER: two different accounts. Optional card and bill date must appear together.
- CARD_BILL_PAYMENT: source account, card and bill date; one recorded payment per bill.
- INVESTMENT: saving and source account, or `opening: true` without an account.
- REDEMPTION: saving and destination account; cannot exceed the current saving value.

Amounts are positive BigDecimals. Every referenced account, card and saving is checked
against the current owner (404 otherwise). Stored movements prevent account/card
deletion with a clear 400. Saving deletion cascades to movements and valuations.
Deleting a card's configured payment account clears its funding configuration too.

`TransactionOccurrence` projects saved installments, bill dates and recurring entries.
Monthly values use `Transaction.amountIn`; dates use `Transaction.dateIn`, including
skips, overrides and clamping. Financing installments retain their explicit amounts.
Balances, bill totals and overview use this same ledger projection.

A bill is one per card and month: the card's expense occurrences minus its income
occurrences in that month, including installments. Installments keep the due day the card
had when they were bought, so after a bank moves the due day a month can hold two dates;
the bill takes the date that carries most of its amount, and a recorded payment for any
day of that month replaces the automatic one. Income validation and the database trigger now
accept card credits, fixing the previous rejection of imported card refunds.

Positive bills on or after the first transaction derive a payment on their due date
when the card has a payment account. A funding account also derives a transfer of the
bill total to the payment account. Automatic movements have `automatic: true` and null
id and are never stored. Bills with zero/negative totals derive nothing.

A recorded payment replaces only the automatic payment for `(cardId, billDueDate)`.
**The funding transfer remains automatic until a recorded TRANSFER explicitly supplies
the same cardId and billDueDate.** Ordinary transfers do not replace it. One explicit
funding transfer is allowed per bill, with its own date, amount and accounts. Deleting
a replacement restores the automatic movement while the configuration still requires
one. Automatic rows cannot be edited/deleted; record the payment instead (400 at
`/movements/automatic`). The movement form explains the funding rule.

Checking statement import extension:
`ledger/application/MoneyFlowService.matchBillPayment(accountId, date, amount, description)`.
It checks account ownership and delegates to `ledger/domain/BillPaymentMatcher` using
stored and automatic payments. A candidate requires an exact account and absolute
amount, a date within three days, a nonblank description and exactly one match. It
writes nothing. Tests cover date boundaries, wrong accounts and ambiguity. Checking
statement imports remain a future feature.

## Account balances

A checkpoint is the bank's end-of-day balance, unique per account/date. A dated
balance starts with the latest checkpoint on/before that date, then adds flows strictly
after the checkpoint date through the requested date. Before an account's first
checkpoint, the balance is that checkpoint minus the flows in between, so entering
today's balance once gives every earlier month too; with no checkpoint it starts at zero. Income adds;
non-card expenses subtract. Card purchases/credits never affect accounts directly.
Movements apply their source/destination effects. Negative balances are supported.

Checkpoint POST accepts `{date, balance, preview}`. Preview returns `computed`, the
bank `balance`, `difference = balance - computed`, and `saved: false` without writing.
Confirmation saves/replaces that date's checkpoint. Opening bank balances use this
same mechanism. The settings dialog shows the difference before confirmation and
lists checkpoints with deletion controls.

## Savings history

Savings retain current `amount`, and expose `invested` (net contributions including
opening contributions) and `gain = amount - invested`. Ledger models reference only a
saving UUID and ask the savings application boundary for ownership/value operations.
A synchronous `SavingOpened` event records an opening contribution for new savings.
V14 backfills existing positive amounts on their UTC creation date. Zero amounts need
no opening row because movements require positive amounts.

Valuations are end-of-day values, unique per saving/date; saving again replaces that
date's valuation. `SavingValue.at` uses the latest valuation on/before a date plus net
contributions strictly after it. Without a valuation it uses net contributions. A
valuation includes all flows on its own date. Existing form value edits record today's
valuation; Update value accepts a date. Movement writes and valuations reconcile the
persisted current amount from today's history, including flows after a backdated
valuation. Reconciliation uses a saving row lock. Removing/changing a contribution
cannot leave the current saving value negative.

History returns dated movement and valuation arrays; the web combines them in date
order. Apply and Redeem reuse the New entry movement form.

## Overview and evolution

The overview context contains application and HTTP adapters only and reads ledger,
savings and financing application services. Transaction/installment data and monthly
overrides load in two queries to avoid fetching two Hibernate bags together. Expansion
and aggregation run in Java. Evolution loads ledger data once, savings/valuations and
financings once, and computes each financing schedule once, without per-month database
queries or date extraction on bound parameters.

The monthly overview includes income, expenses, surplus, invested (non-opening
investments minus redemptions), kept (surplus minus invested), month-end/today account
balances and latest checkpoint dates, bills, and unassigned entry count/absolute total.
Card purchases stay in their bill month's expense totals. A bill's payment account
comes from its stored/automatic payment. Paid is inferred when a payment exists and
the due date is before today; it is not bank settlement confirmation.

Evolution starts in the first transaction month and ends in the current month, with
income, expenses, surplus, invested, account balances, saving values, financing debt
and net worth. Debt uses the last installment balance due on/before month end, or the
original principal before the first installment. Net worth = accounts + savings -
debt. With no transactions, evolution is empty. Current-month end values include
scheduled flows through month end, so they are projections. Today's account balance
is separate. The existing API UTC Clock defines today.

## HTTP, client and web

- `/movements`: date-range GET and POST; `/{id}` PUT/DELETE.
- `/cards`: writes accept paymentAccountId/fundingAccountId; responses return account
  summaries as paymentAccount/fundingAccount.
- `/accounts`: responses add balance and balanceCheckpointDate;
  `/{id}/balance?date=` computes a dated balance; `/{id}/balance-checkpoints` GET/POST;
  `/{id}/balance-checkpoints/{checkpointId}` DELETE.
- `/savings`: responses add invested/gain; `/{id}/history` GET;
  `/{id}/valuations` POST accepts `{date, value}`.
- `/overview/{yyyy-MM}` and `/overview/evolution`: GET.

Write DTOs for movements, cards, savings, checkpoints and valuations are distinct from
responses. Dates use yyyy/MM/dd and months yyyy-MM. OpenAPI, regenerated SDK, Zod
models and handwritten client methods cover the endpoints. No dependencies were added.

The web adds Movement to New entry, card payment/funding selectors, account balances
and adjustment previews, and saving contributions/redemptions/valuations/history.
All new strings are English and Brazilian Portuguese; controls follow existing panel
styles and API display dates use parseApiDate. refreshMoneyFlow refreshes affected SWR
keys and registered transaction lists. Existing transaction refreshes now invalidate
account balances and overview keys too.

## Verification

Domain tests cover movement rules, installments/credits, automatic replacement,
checkpoint boundaries, monthly overrides/skips, financing flows, valuations and
redemption limits. Overview tests cover evolution, debt and net worth. Bilingual Jest
tests cover conditional fields, transfer saving, balance preview/confirmation and
saving actions. Testcontainers coverage was added in MoneyFlowIntegrationTest and
MoneyFlowMigrationTest for CRUD/ownership, derived payments/replacement, balances,
saving history, overview/evolution and migration backfill/null card accounts.

Docker's socket is inaccessible in this sandbox: integration/migration tests compile
but require a Docker-enabled run. API unit tests, ArchitectureTest, PMD, Spotless and
SpotBugs pass. Shared-client check passes. Web check passes (193 tests). Production
build passes with an external preload reading TypeScript configuration through its
API; ordinary Next.js child processes return empty --showConfig output here. Jest
also needs --watchman=false. Neither workaround changes repository configuration.

## Implementation files

API paths below are under apps/api/src/main/java/com/budgetmanager/bm:

- ledger/domain: Movement, MovementKind, MoneyFlow, TransactionOccurrence,
  AccountBalance, BillPaymentMatcher, Transaction and Card.
- ledger/application: MoneyFlowService, AccountService and CardService.
- ledger/infrastructure/http: movement and balance adapters, AccountResponse,
  AccountController, CardDraft, CardDto and CardController; persistence: movement,
  checkpoint, card and transaction repositories.
- savings/domain: SavingValue and SavingValuation; application: SavingMoneyService,
  SavingHistoryService, SavingValuationService, SavingOpened and SavingService.
- savings/infrastructure/http: SavingHistoryController, SavingController, SavingDraft,
  SavingDto and SavingConverter; persistence: saving/valuation repositories.
- overview/application/OverviewService and overview/infrastructure/http/OverviewController.

Other changed files:

- apps/api/src/main/resources/db/migration/V14__money_flow.sql and API MoneyFlowTest,
  SavingValueTest, OverviewServiceTest, MoneyFlowIntegrationTest, MoneyFlowMigrationTest.
- packages/api-client/openapi.yaml, src/money-flow.ts, models.ts, endpoints.ts,
  index.ts and regenerated src/generated files.
- apps/web/src/components/MoneyFlow (forms, styles and tests), NewTransaction,
  AccountsSection, SavingEntry, cards/savings settings pages, saving type, transaction
  and money-flow cache helpers, and both i18n message files.

## Home: month at a glance

Home replaces the two transaction tables and the old Balance/Charts blocks with:

- A month picker and New entry drawer, followed by income, expenses and surplus.
  The surplus split shows net investments and money kept in accounts. Invest the
  surplus opens the movement drawer with the kept amount, the account receiving
  the most income, and the earlier of today and month end. It still requires a
  saving destination. Negative months show the shortfall and net account cash
  outflows (including bill payments and movements); these are ledger flows, not
  confirmation that the bank settled a particular expense. Unassigned entries
  cannot be attributed to an account.
- Today's account balances, latest checkpoint dates, the existing balance
  adjustment dialog, and a shortcut to entries without an account.
- Monthly card bills with payment account, automatic/recorded and due/paid status,
  plus financing installments linking to their contracts.
- Surplus and investment bars and a net-worth line, with a 12-month/all-time
  switch, localized BRL tooltips and compact axes. Current-month end figures are
  projections, as in the overview API.
- One searchable month list with income, expense and movement filters, category,
  payment instrument and unassigned filters. All API pages load before filtered
  totals are shown; only 30 matching rows render per page. Transaction rows retain
  monthly scopes, installment actions and payment labels. Automatic movement rows
  open a prefilled replacement form; recorded movements can be edited or deleted.

The expense category pie is omitted here because Analytics already provides it.
Summary actions and subsequent blocks remain separate components for the upcoming
Goals feature; no goals are implemented. English and Brazilian Portuguese share
all controls. No API or shared-client changes are required. Existing transaction
and money-flow refresh helpers revalidate the overview after mutations.

Home verification: web formatting, ESLint, strict TypeScript and all 218 Jest tests
pass. Production build passes. This sandbox still requires the external TypeScript
configuration preload described above and `--watchman=false` for Jest. API and
shared client are unchanged. Responsive row grids and drawers fit small viewports;
no live-bank reconciliation or browser screenshot validation was performed.
