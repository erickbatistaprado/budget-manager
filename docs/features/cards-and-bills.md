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
the card clears the bill date. Repeating transactions cannot have a card.
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
