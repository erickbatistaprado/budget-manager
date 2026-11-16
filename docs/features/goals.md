# Goals (metas): things to buy, in order, funded from the month's surplus

Status: phases 1, 2 and 3 implemented. Builds on the money flow feature (movements,
savings history, month overview) and the new Home.

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

1. Goals, ranking, manual allocations, plan and projection, goals page (implemented).
2. "Guardar a sobra" on the Home, "Próxima meta", purchase flow (implemented).
3. Savings tips (implemented).

## Phase 1 implementation

- **Database (`V17__goals.sql`)**: adds `main_account_id` (`REFERENCES t_account(id) ON DELETE SET NULL`) and `goal_monthly_pace` (`>= 0`) to `t_user`, plus `t_goal` and `t_goal_allocation`. Both tables and the new user preferences are included in the user data export (`UserDataRepository`).
- **Domain (`goals/domain`)**: `Goal`, `GoalAllocation`, and pure funding/projection logic in `GoalFunding` (6-month average of kept history with negative months clamped to zero, fixed `monthlyAmount` served first then waterfall by rank, 120-month simulation cap, late target-date detection with binary search for minimum extra monthly pace and 1st-place simulation, rank move renumbering, and nonzero allocation/release validation).
- **Application & HTTP (`goals/application/GoalService`, `goals/infrastructure/http/GoalController`)**: owner-scoped `GET/POST /goals`, `PUT/DELETE /goals/{id}`, `PUT /goals/{id}/position`, `GET/POST /goals/{id}/allocations`, `GET /goals/plan`, and `PUT /goals/pace`, serialized per owner lock. Positive allocations on a goal with a `savingId` create an `INVESTMENT` movement via `MoneyFlowService`; releases (`amount < 0`) reduce the reservation while leaving linked savings invested. Changing a goal's linked saving requires releasing existing allocations first.
- **Main account preference**: `PUT /users/current/preferences` accepts `mainAccountId` (verified for ownership) alongside `salaryDay`, exposed on `GET /users/current`. Profile > Preferences includes the main account `Select`. The web uses `mainAccountId` as the default account in the goals allocation form, movement form, and Home's "Investir a sobra" prefill (falling back to the account with the most income).
- **Web (`apps/web/src/app/(private)/goals/page.tsx`, `components/Goals/*`)**: "Metas" / "Goals" in the side menu between Savings and Financing; pace card with inline override and reset to the 6-month average plus reserved and free available balances; ranked goal list with drag-and-drop and keyboard up/down buttons, `Preciso`/`Quero` badges, progress bars, expected month, target-date warnings, and actions to set aside, release, edit, and delete with confirmation.

## Phases 2 and 3 implementation

- **Migration V19** adds nullable `t_category.fixed_cost` and purchase snapshots
  `t_goal.saved_at_purchase` / `actual_price`. Existing `achieved_at` and
  `expense_transaction_id` record the purchase date and ledger transaction. Export's
  owner-scoped `SELECT *` sections already include all these new columns.
- **Surplus split**: `POST /goals/allocate` accepts `date` (`yyyy/MM/dd`), `amount`,
  `fromAccountId`, `preview`, and optional `allocations` (goal ID to amount). The
  default uses fixed monthly contributions followed by the ranked waterfall. It
  returns `goals`, `investmentAmount` and `saved`. Preview locks the owner for a
  consistent calculation but writes no allocations or movements. Confirmation
  saves only the goal lines; linked savings receive ordinary investment movements.
  The server rejects amounts above the month's kept value less that month's active
  reservations without a saving, and rejects negative or excessive split lines.
- Home's **Guardar a sobra** drawer loads that month's existing reservations,
  previews the remaining surplus and allows editing every goal and the investment
  amount. It displays the total and unassigned remainder. The account defaults to
  `mainAccountId`, falling back to the account receiving most income; date is the
  earlier of today and month end. Investment defaults to the last used saving,
  otherwise none. The investment portion uses the existing movements endpoint.
  These are two requests: if the investment request fails after goals are saved,
  the drawer locks the split and offers a retry without duplicating allocations.
- **Próxima meta** shows the first active goal, progress, and expected month beside
  the summary on large screens and below it on small screens. The empty invitation
  opens the Goals page's new-goal form.
- **Purchase**: `POST /goals/{id}/purchase` accepts `price`, `date`, `categoryId`,
  `paymentMethod`, `cardId` or `accountId`, and optional credit-card `installments`.
  It calls `TransactionService.save`, validates an expense category, redeems the
  entire saved allocation into the paying account (main account for credit cards,
  or `redemptionAccountId` when there is none),
  releases the entire reservation, records purchase snapshots and marks the goal
  achieved, then renumbers the active goals, in one transaction. Cash/other
  payments can supply `redemptionAccountId` without assigning a bank account to the
  expense. A linked saving must have enough value for redemption. Repeating a
  purchase or moving an achieved goal is refused. Achieved goals follow active
  goals in the API and appear in the collapsed **Conquistadas** section.
- **Savings tips**: `GET /goals/savings-tips?month=yyyy-MM` defaults to the last
  complete month and compares it against the six months **before** that month,
  including zero-spend months. Pure `GoalSavingsTips` arithmetic counts spending
  by purchase month: a single card purchase counts when it was made, not when its
  bill is due, while installments keep their own months. Monthly series, financing
  and fixed categories are excluded.
  Results are the top three by absolute excess above average (stable category/ID
  tie breaking). The excess increases the existing goal pace for a new projection
  starting this month; results include both forecast months and months gained.
  Percentage is null when the historical average is zero; months gained is null
  if there is no active goal or a forecast exceeds the 120-month horizon.
- The tips card includes a month switcher and fixed-cost category settings using
  owner-scoped `PUT /categories/{id}/fixed-cost` with nullable `fixedCost`. All new
  controls use the shared kit and messages in English and Brazilian Portuguese.

### Verification

Domain tests cover split remainder and limits, controllable-category exclusions,
ranking of tips and forecast gains. Purchase service tests cover ledger expenses,
redemption destinations, releases, snapshots and renumbering. Testcontainers tests
cover preview vs confirmation, purchase balances, card installments, tips, ownership
and migration. Web tests exercise both languages for the split, next goal, purchase,
achieved list and tips/settings.

Verified with `./mvnw clean verify` (Testcontainers included), `npm run check` in the
client and web, the production web build, and screenshots of Home, the split drawer, the
Goals page, the purchase drawer and the achieved list at 1440px and 375px (no sideways
scroll).
