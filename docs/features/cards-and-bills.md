# Cards and bill months

Cards belong to a user and have a unique name (ignoring case), closing day and due
day. `V10__cards_and_bills.sql` adds cards and nullable card/bill-date columns to
transactions; existing purchases keep their original dates and schedules until
edited or enriched by re-importing a bill. Deleting a card clears its reference
but retains each purchase's bill date and installments. Editing a card's settings
applies to subsequent saves, without rewriting saved bills.

A purchase on or before the clamped closing day goes into that closing; a later
purchase goes into next month's closing. Its bill falls on the first clamped due
day strictly after closing. Closing on the 25th and due on the 5th puts a December
12 purchase in January's bill, and a December 26 purchase in February's bill.
Days are clamped separately in each month, including leap years.

Manual transaction saves accept `cardId`. The server resolves ownership and
computes the bill date, ignoring supplied bill dates and card summaries. Clearing
the card clears the bill date. A monthly series may be charged to a card (insurance, subscriptions): it keeps no
bill date, and each month's charge belongs to that month's bill (V16). Other repeat
intervals cannot have a card.
Installment schedules start from the first bill date, falling back to the purchase
date when absent. Changing only the bill date preserves paid-early installments.

Non-repeating purchases without installments count on `billDueDate ?? date` in
listings, Home totals, charts, Analytics and spending room. Listings still sort
by purchase date. Installments count by their individual due dates; monthly series
keep their month overrides and existing behavior. Rows retain the purchase date
and show the bill month. Future bills are committed spending in Analytics.

Statement preview reads due dates from Bradesco monthly PDFs, NuBank PDFs and
NuBank CSV filenames (`Nubank_2026-12-07.csv`). Bradesco's open bill has no due date;
preview supplies its export `statementDate`, and selecting a card defaults to the
next due day strictly after that date. Both dates use `yyyy/MM/dd` in the API.

Import accepts optional `cardId` and `billDueDate`. An explicit bill date takes
precedence over card calculation. For installment n, the stored first bill date
is the statement bill date minus n−1 months. Prepaid installments move to the
statement bill due date when supplied. Already-saved purchases with no bill date
are enriched and their unpaid schedules move, without creating duplicates;
`billDatesSet` counts distinct saved purchases changed. Already assigned bill
dates are retained. The review screen includes saved duplicate lines when applying
a bill date, even if no new lines are selected, and explains this behavior.

The API tests cover ownership, validation, migration, saving, import, enrichment
and listing count queries against PostgreSQL/Testcontainers. Synthetic parser
fixtures and domain tests cover closing boundaries and short months. Web tests
cover date calculations, projections, card selection, import defaults/re-import
and delete confirmation. No real statement data is added to the repository.

## Optional credit limits

V15 adds nullable `t_card.credit_limit` (`NUMERIC(19,2)`, positive when set).
Existing cards retain a null limit. Create/update accepts nullable `creditLimit`,
positive with at most two decimal places; null or omission clears the limit.
Card responses include `creditLimit`, `usedLimit` and `availableLimit`; usage and
availability are null without a limit. Monthly overview bills also include the
card's current `creditLimit` and `availableLimit`, regardless of the month viewed.

Limit usage reuses `TransactionOccurrence` and the same monthly bill grouping as
money flow: expense occurrences minus credits across all unpaid bills, including
all future installments of saved purchases. The projection has no fixed future
month cutoff. A bill releases its limit only when a recorded or automatic
`CARD_BILL_PAYMENT` exists for its card/month and its due date is strictly before
UTC today. A funding transfer alone does not release it. Paying on the due date
keeps the bill reserved until the following day, matching the overview rule.
Available limit is credit limit minus usage and can be negative; credits are not
clamped. Automatic payment remains an inference, not bank settlement confirmation.

Cards has an optional money field on create/edit and a localized available/total
line with a thin usage bar. Usage above 90% is red; over-limit cards also display
“Acima do limite” / “Over the limit”. Home bills show the same available/total line.
Both English and Brazilian Portuguese are supported. Shared kit fields default
to full container width, keep labels/notches/values on one line, reserve select
arrow space and fit small-size values. Forms and Home filters use responsive grids;
transaction and movement entries use one shared kit row layout and icon actions.

Domain tests cover future installments, credits, paid/unpaid and due-today bills,
automatic/recorded payments, funding transfers, over-limit values and absent limits.
Testcontainers coverage checks limit creation/validation, purchase/installment usage
before and after payment, existing ownership 404s and V14-to-V15 null backfill.
Jest covers optional positive inputs, editing/clearing, localized limit lines/bars,
and kit width/no-wrap/small-padding behavior; the native-controls scan remains active.

Verification for limits: API unit tests (217 tests, one optional local-fixture test
skipped), ArchitectureTest, PMD, Spotless and SpotBugs pass. Full `./mvnw verify`
was attempted, but PostgreSQL/Testcontainers cannot access Docker's socket in this
sandbox; integration and migration tests compile but remain unverified here.
Shared-client `npm run check` passes. Web `npm run check` passes all 253 tests and
production build passes using the external TypeScript configuration preload and
`--watchman=false` described in money-flow.md. Browser review at 1440px/375px and
in dark theme remains unverified: preview servers cannot bind either all interfaces
or localhost (`listen EPERM`). No repository configuration workaround was added.

## Bank installment amounts and card subscriptions on import

When importing a statement line that matches an installment of a saved purchase
(or creating a new installment purchase from a line), `Transaction.adjustInstallmentAmount`
accepts the bank's installment amount when the difference is at most R$ 1.00,
keeping the other installments unchanged and updating `total_value` to the sum of
all installments. Installments marked paid early, financing-managed purchases and
differences above R$ 1.00 are never adjusted. `StatementImportResultDto` reports
`installmentAmountsAdjusted`, which is displayed in the import result banner.

`SubscriptionMatcher` matches non-installment, non-prepaid statement lines for a
selected card against active monthly series (`repeats = MONTHLY`, not skipped in
the bill month) charged to that card. A line matches when its description matches
(normalized equality or shared prefix of at least 6 characters) or its amount is
within R$ 0.05 of the series occurrence in the bill month. Matched lines are
marked as duplicates (unselected, naming the series in the preview). When the
description matches and the amount differs, the preview offers an option to
update that month's amount (`updateMonthAvailable` / `updateMonth`), which stores
a per-month override via `Transaction.changeMonth` without modifying other months.
