# Shared UI

Import components and prop types from `@/components/ui` or `@/components`.
All controls pass native attributes, event handlers, and refs to their native
control. `Panel` and `Field` accept native refs through React 19's ref prop.
Appearance tokens live in `styles.ts`; callers supply layout classes only.

- `Button`: `variant="primary" | "secondary" | "danger" | "ghost"`,
  `size="sm" | "md" | "lg"`, `fullWidth`, and optional `selected`.
  Defaults: secondary, md, `type="button"`. Pressed/checked buttons also receive
  the shared selected styling.
- `IconButton`: Button props plus required `aria-label`; defaults to sm.
- `TextInput`: native input props; `NumberInput` fixes `type="number"`.
- `Select`: native select props plus optional `options` containing
  `{ value, label, disabled? }`, or ordinary option/optgroup children.
- `Checkbox`: native input props except type, plus optional `label` on the right.
- `Field`: one control child, `label`, optional `hint` and `error`. Preserves the
  child's id and existing descriptions, generates an id if needed, and associates
  hint/error text through `aria-describedby`. Errors set `aria-invalid`.
- `Panel`: optional `title` heading and `as="section" | "form" | "div" | "li"`.
  Defaults to section. Native form submission and list semantics are retained.
- `Badge`: native span props.
- `DismissOverlay`: a backdrop button with required `aria-label`, native button
  props, and default `type="button"`.

`buttonClassName()` and `panelStyle` from `styles.ts` also style Next.js links
without changing navigation into button behavior.

## Migration inventory

Pages:

- `app/(private)/analytics/page.tsx`
- `app/(private)/cards/page.tsx`
- `app/(private)/financings/page.tsx`
- `app/(private)/financings/[id]/page.tsx`
- `app/(private)/financings/new/page.tsx`
- `app/(private)/import/page.tsx`
- `app/(private)/savings/page.tsx`
- `app/(public)/auth/page.tsx`

Components (paths relative to `src/components`):

- `Accounts/AccountsSection.tsx`, `Analytics/AnalyticsPanels.tsx`
- `Balance/Balance.component.tsx`, `Bank/Bank.tsx`, `Body/Body.component.tsx`
- `Charts/Charts.component.tsx`
- `DatePickerCustomButton/DatePickerCustomButton.component.tsx`
- `FinancialMovements/FinancialMovements.component.tsx`
- `Financing/ExtraPaymentDialog.tsx`
- `Header/Header.component.tsx`, `HeaderCell/HeaderCell.component.tsx`
- `Home/Drawer.tsx`, `Home/EntryList.tsx`, `Home/Evolution.tsx`,
  `Home/MonthSummary.tsx`, `Home/MovementRow.tsx`
- `Input/Input.component.tsx`
- `InstallmentPrepayment/InstallmentPrepayment.component.tsx`
- `LanguageSwitcher/LanguageSwitcher.component.tsx`
- `LoginForm/LoginForm.component.tsx`, `MenuButton/MenuButton.component.tsx`
- `MoneyFlow/BalanceAdjust.tsx`, `MoneyFlow/MovementForm.tsx`,
  `MoneyFlow/SavingActions.tsx`
- `NewTransaction/NewTransaction.component.tsx`
- `ProfileForm/ProfileForm.component.tsx`, `Savings/SavingEntry.tsx`
- `SelectWithTooltip/SelectWithTooltip.component.tsx`
- `Tooltip/Tooltip.stories.tsx`, `Transactions/Transactions.component.tsx`
- `index.ts` exports the kit; MoneyFlow and Financing's old `styles.ts` files
  were removed.

## Retained specialized elements

The only application-owned native inputs outside the kit are the statement file
picker in the import page and photo file picker in ProfileForm. The floating
Input retains its label/password-eye behavior using TextInput and shared tokens.
SelectWithTooltip retains its tooltip and icon composition using Select.
React Datepicker's internal markup and MUI charts remain provider-owned; the
application's custom date picker buttons use the kit. Progress bars, avatars,
and tooltips retain their non-control styling.

`native-controls.test.ts` scans TSX syntax in app and components, including
stories and tests, and rejects styled native buttons/selects/non-file inputs
outside this directory.

Outlined fields share `label`, `size="small" | "medium"` (40/56px),
`fullWidth`, `required`, `disabled`, `error`, `helperText`, `startAdornment`
and `endAdornment`. `Field` passes its label into its child; do not add another
caption above it. Labels and the hidden legend use the same text for the notch.

`DateField` takes `Date | null`, `onChange`, optional `min`/`max`.
Desktop input follows the active language and reports incomplete or invalid dates;
touch devices use their native picker. `parseFieldDate`/`formatFieldDate` bridge
existing ISO form state without UTC conversion. `MonthSwitcher` takes `value`
and `onChange` and provides arrows and a keyboard navigable year/month popover.
