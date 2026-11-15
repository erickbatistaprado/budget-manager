# Financing (financiamentos)

Status: planned, not started.

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
