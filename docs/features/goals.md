# Goals (metas): things to buy, in order, funded from the month's surplus

Status: planned. Builds on the money flow feature (movements, savings history, month overview) and
the new Home; start after both are merged.

A wishlist that turns into a plan: what the user wants to buy, in which order, when each one will
be affordable at the current pace, and what could make it sooner.

## Goals

1. Keep a ranked list of wishes ("Viagem para NY", "Teclado novo", "Hardware") with a price and,
   optionally, a target date.
2. Put money aside for them from the month's surplus, next to investing it.
3. Show when each wish will be funded, and warn when a target date will not be met.
4. Point out where spending could drop to get there sooner, from the user's own history.
5. When a wish is bought, record the expense and keep it as an achieved goal.

Not in scope at first: price tracking from stores, shared goals between users, currency other
than BRL (a trip priced in dollars is entered in reais).

## Model

`t_goal` (new `goals` context):

- id, user_id, name, price (> 0), link, notes, kind (`NEED` "Preciso" / `WANT` "Quero"),
  target_date (optional), position (rank, 1 = first), monthly_amount (optional fixed monthly
  contribution), saving_id (optional: the saving that holds the money, e.g. a CDB for the trip),
  status (`ACTIVE`, `ACHIEVED`, `CANCELLED`), achieved_at, expense_transaction_id, created/updated.
- Reordering moves one goal and renumbers the rest, in one transaction.

`t_goal_allocation`: money set aside for a goal.

- id, goal_id, date, amount (positive to set aside, negative to release), movement_id (optional:
  the `INVESTMENT` movement when the goal has a saving).
- A goal's saved amount = the sum of its allocations. With a saving, setting money aside is an
  `INVESTMENT` movement into that saving plus the allocation; without one, the allocation only
  reserves money that stays in the accounts ("reservado").
- Reserved money is shown apart from the free balance: free available = accounts balance minus
  reservations of goals without a saving.

## Prioritization and funding

- Priority is the rank the user sets by dragging; no computed score. The `NEED`/`WANT` tag and
  the target date are information and drive the warnings, never a reorder by themselves.
- Funding is a waterfall by default: money set aside goes to the first goal until it is fully
  funded, then to the next. A goal with a `monthly_amount` receives that amount first each month,
  whatever its rank; the rest follows the waterfall.
- Pace: the expected monthly amount for goals = the average of "kept" (surplus minus invested) over
  the last 6 complete months, or a value the user sets on the goals page ("Vou guardar R$ X por
  mês"). The projection simulates month by month with that amount (fixed monthly amounts first,
  then the waterfall) and gives each goal its expected funding month.
- Warning: when a goal's expected month is after its target date, say so and how much more per
  month would meet it, and what moving it to first place would give.

## Saving more ("Como chegar lá mais rápido")

- Compare the current and last month with the user's 6-month average per category, only for
  categories the user can control: exclude monthly series (rent, condo, bills), financing
  installments and categories the user marks as fixed.
- Show the top categories above their average: amount, how much above, and what cutting the
  difference would do to the first goal's expected month ("Delivery: R$ 900 este mês, 40% acima
  da sua média; cortar R$ 300/mês antecipa o teclado em 1 mês").
- Plain arithmetic on the user's own data; no external services, no investment advice.

## Buying

"Comprei" asks for the real price, date, category, payment method and card or account, then:
creates the expense (a normal transaction, so it counts in that month like any other), redeems
the saved amount from the goal's saving (a `REDEMPTION` movement into the paying account) when it
has one, marks the goal `ACHIEVED` with a link to the expense, and releases any leftover
allocation. Achieved goals stay listed under "Conquistadas" with what was saved and when.

## API

- `GET /goals` (active by rank, then achieved), `POST /goals`, `PUT /goals/{id}`,
  `DELETE /goals/{id}` (releases allocations; refuses when achieved), `PUT /goals/{id}/position`.
- `POST /goals/{id}/allocations` (amount, date, optional from account when the goal has a saving),
  `GET /goals/{id}/allocations`.
- `POST /goals/allocate` (amount, date: split by the funding rules across goals; returns the
  split, with `preview` to show it before saving).
- `POST /goals/{id}/purchase` (the "Comprei" fields above).
- `GET /goals/plan` (pace used, each goal's saved amount, remaining, expected month, target date
  warning) and `GET /goals/savings-tips?month=yyyy-MM`.
- Owner-scoped (404), separate request and response DTOs, documented in `openapi.yaml`.

## Web

- "Metas" in the menu. Page with the ranked list (drag handle plus keyboard move up/down buttons),
  each row with name, `Preciso`/`Quero`, price, progress bar (saved / price), expected month, the
  target date warning, and actions (Guardar, Editar, Comprei, Excluir). A pace card ("Ritmo:
  R$ X/mês, média dos últimos 6 meses", editable) and the "Como chegar lá mais rápido" card.
  Achieved goals collapsed below.
- Home: the month summary's "Investir a sobra" becomes "Guardar a sobra", a dialog that splits
  the kept amount between investments and goals (default: goals by the funding rules, editable),
  with a preview. A small "Próxima meta" card: name, progress, expected month.
- Same panel, field, select and button styles as the rest of the app; English and natural
  Brazilian Portuguese (Metas, Preciso, Quero, Guardar, Reservado, Comprei, Conquistadas, Ritmo,
  Previsão, "Como chegar lá mais rápido").

## Tests

Domain: waterfall and fixed monthly amounts, projection months, target date warnings, reorder,
allocation and release, purchase (expense, redemption, leftover released), tips excluding fixed
categories. Testcontainers: CRUD and ownership, allocate with and without a saving (movement
created or not, balances), purchase end to end, migration. Web: list reorder by keyboard,
"Guardar a sobra" split preview, purchase dialog, both languages.

## Phases

1. Goals, ranking, manual allocations, plan and projection, goals page.
2. "Guardar a sobra" on the Home, "Próxima meta", purchase flow.
3. Savings tips.
