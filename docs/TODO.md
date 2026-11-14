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

### Import bank statements from PDF

Import expenses from the PDF statements that NuBank and Bradesco provide, so no
paid bank-connection service is needed.

- [ ] Collect sample PDFs: NuBank credit-card bill, NuBank account statement,
      Bradesco credit-card bill, Bradesco account statement.
- [ ] Build anonymized test fixtures from them. Real statements never enter the
      repository (see `.gitignore`).
- [ ] Upload endpoint: accepts a PDF, detects the bank and document type, and
      extracts its text (Apache PDFBox), with no data sent to third parties.
- [ ] One parser per bank and document type, returning date, description, amount,
      installment info (for example `Parcela 3/10`) and whether it is a refund or
      payment.
- [ ] Review screen before saving: the user sees every parsed line, picks or
      corrects categories, and can drop lines.
- [ ] Duplicate detection, so importing the same bill twice or overlapping
      statements does not double-count expenses.
- [ ] Category suggestions learned from past imports (same description, same
      category).
- [ ] Credit-card installments map to the existing installment model instead of
      creating separate transactions.
- [ ] Clear error when a PDF is password-protected, scanned (image only) or from
      an unsupported bank.
- [ ] Import from the web and mobile apps.
