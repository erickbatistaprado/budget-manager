# TODO

Work tracked for Budget Manager. Tick items off as they land on `main`.

## Fixes from the November 2026 review

### Backend correctness and security

- [x] Categories belong to a user: `user_id` on `t_category`, names unique per
      user and transaction type (case-insensitive), and ownership is checked on
      every transaction write. Migration V3 copies existing categories to every
      user and moves each transaction to its owner's copy.
- [x] Installments add up to the transaction total: round down and give the
      leftover cents to the last installment.
- [x] Updating a transaction keeps installments consistent: they are rebuilt when
      the total, date or installment count changes, and kept otherwise.
- [x] One refresh token per device or session instead of one per user.
- [x] Refresh-token rotation is atomic, and tokens are stored hashed.
- [x] An invalid or expired access token does not block public endpoints.
- [x] Shorter default access-token lifetime (15 minutes), with refresh-on-401 in
      the web app and the shared API client.
- [x] Changing the password signs out every device.
- [x] One CSRF token works for the whole session. It was cleared after every
      authenticated request, and the web app only hid it by retrying on 403.
- [x] CSRF failures and other errors keep their status code instead of turning
      into 401 (`/error` was not public).
- [x] `/actuator/health` is public for load balancers and container checks.
- [x] Secure cookies by default (`COOKIE_SECURE=false` only in local `.env`).

### Architecture

- [x] Application services stop importing HTTP DTOs and converters.
- [x] Controllers return DTOs, never entities.
- [x] Domain classes drop Jackson annotations.
- [x] ArchUnit enforces the rules above.

### Cleanups

- [x] Same precision for every money column (`numeric(19, 2)`).
- [x] Seed roles in one place (the migration), not also in `RoleInitializer`.
- [x] Relax the password rule: at least 8 characters, any symbol, at most 72 bytes
      (BCrypt's limit).
- [ ] Recurring transactions: `repeats` is used by the listing query, but a
      repeating transaction shows once per period whatever its interval (a DAILY
      expense counts once a month). Expand it per interval or simplify to
      monthly only.
- [x] Service-level tests for categories, transactions, installments and auth,
      against PostgreSQL in Testcontainers.

### Dependencies

- [x] API: Spring Boot 4.1.2, Maven 3.9.16, plugins and libraries.
- [x] Web: Next.js 16.4, React 19.3, MUI X Charts 9, Vitest 5.
- [x] Mobile: Expo SDK 58, React Native 0.88.
- [x] Shared API client: already on the latest generator.
- [x] Web Docker image builds again: it needs the monorepo as build context to
      reach `packages/api-client`.

### Follow-ups found during the upgrade

- [x] Dates from the API were read as midnight UTC, a day early in Brazil;
      anything due on the 1st showed in the previous month.
- [x] A month with several installments of one purchase (after a prepayment)
      showed and counted only one.

- [ ] ESLint 10: eslint-config-next and eslint-config-expo plugins do not
      declare support yet; npm marks ESLint 9 as deprecated.
- [ ] TypeScript 7: blocked by typescript-eslint and the OpenAPI generator.
- [ ] `@mui/x-charts` is pinned to 9.17.0 because 9.18.0 ships a broken vendor
      package. Unpin when a fixed release lands.
- [ ] Storybook build is broken (it was before the upgrade): `.storybook/main.ts`
      maps to `src/storybook-mocks/*`, which does not exist.
- [ ] `BalancePieChart` hides its legend with a cast that probably does nothing;
      use the `hideLegend` prop.
- [ ] Mobile: when a refresh fails mid-session, send the user back to sign-in
      (today only the start-up check does).
- [ ] Mobile: SDK 58 defaults `web.output` to `server`; set `static` if the web
      target matters.

## Features

### Analytics and languages

- [x] Analytics redesign: week, month, year or custom periods; income, expenses,
      net, savings rate and spending per day against the previous period; this
      month's and next month's spending room after installments and repeating
      charges; daily spending, income vs expenses, cumulative, categories, top
      merchants, the next 6 months of installments and savings by location.
- [x] English and Portuguese (Brazil), switched from the side menu and kept in a
      cookie so the server renders the right language. Money is always BRL;
      numbers and dates follow the language.
- [ ] Mobile app in Portuguese.

### Import bank statements from PDF

Import expenses from the PDF statements that NuBank and Bradesco provide, so no
paid bank-connection service is needed.

- [x] Sample statements: Bradesco card PDF, NuBank card bill PDF and NuBank card
      CSV, kept in the git-ignored `statements/` folder. `LocalStatementsTest`
      checks each one against its printed total when the folder exists.
- [x] Synthetic test fixtures; real statements never enter the repository.
- [x] Preview endpoint: detects bank and format, reads PDFs with PDFBox (asking
      for the password when needed), nothing sent to third parties.
- [x] Parsers per bank and format: date, description, amount, installments
      (`Parcela 3/10`, `3/10`), credits (refunds, discounts, IOF returns) and
      cardholder. Payments and previous balances are skipped.
- [x] Review screen: select lines, pick or bulk-set categories, add categories,
      hide what is already saved.
- [x] Duplicates: same date, amount, description and category, counted rather
      than collapsed; installment purchases match by description, count,
      installment amount and category, so next month's bill does not repeat
      them. The import checks again on the server.
- [x] Category suggestions, strongest first: the same description, the same
      merchant written differently, a built-in list of well-known merchants and
      words (`MerchantKeywords`), then similar merchants. The latest choice wins,
      the page says where each suggestion came from, and picking a category
      fills the other lines of the same merchant. Everything stays local.
- [ ] Opt-in AI suggestions for lines still unknown, sending only merchant
      names. Not started: it is the only option that sends data off the
      machine.
- [x] Installments create the whole purchase with its schedule.
- [x] Prepaid installments (`Antecipada - … - Parcela 7/8`) move that
      installment to the day it was paid instead of being skipped, whether the
      purchase was saved earlier, is created by another line of the bill, or by
      the prepaid line itself. Re-importing moves nothing twice.
- [x] Pay installments early by hand from a transaction (and undo it), so a
      card prepayment never means deleting and recreating the purchase.
- [x] Clear errors for protected PDFs (asks for the password), scans and
      unsupported files.
- [ ] Bradesco and NuBank account (checking) statements, not only cards.
- [ ] Two identical installment purchases in one bill are treated as one.
- [ ] Import from the mobile app.
