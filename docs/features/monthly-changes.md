# Monthly transaction changes

A monthly transaction covers calendar months from its date through its nullable
`repeatUntil` (inclusive). V9 stores the end as the first day of the last month.
Existing transactions have no end and continue indefinitely.

`t_transaction_month` stores one override per transaction and month, with nullable
amount, date and notes, a skipped flag, and creation/update timestamps. The month
is stored as its first day. The database checks month normalization, positive
amounts and dates inside the month; the domain checks that the transaction is
monthly and covers the chosen month. A month edit saves a complete snapshot of
amount, date and notes, including explicitly cleared notes.

All routes require the transaction's owner; another owner's id returns 404:

- `PUT /transactions/{id}/months/{yyyy-MM}` changes only that month, accepting
  `amount`, `date` (`yyyy/MM/dd`) and `notes`.
- `DELETE /transactions/{id}/months/{yyyy-MM}` skips that month, idempotently.
- `DELETE /transactions/{id}/months/{yyyy-MM}/override` removes its override,
  restoring the series values, including when the month was skipped.
- `POST /transactions/{id}/split/{yyyy-MM}` accepts transaction values, keeps the
  type, ends the original series before the selected month and creates a new
  monthly series. The successor keeps the original end, if present. At the first
  month the original row is updated instead.
- `DELETE /transactions/{id}/from/{yyyy-MM}` ends the series before that month,
  deleting the row when it is the first month.

Cuts discard original overrides at and after the chosen month. Earlier overrides
remain. Whole-row update/delete routes reject monthly transactions; other
transactions keep their existing behavior.

Listings return skipped rows and all overrides, with month keys as `yyyy-MM` and
`repeatUntil` as `yyyy/MM/01`. Web projections resolve the range, overrides,
skips, notes and due date through `monthlyOccurrence`. Skipped rows are hidden
and contribute nothing to Home or Analytics. Regular due days are clamped to the
last day of short months without drifting in subsequent months. Charts and
Analytics include occurrences by their resolved due day within the requested
range.

Home asks for the scope before editing and during inline deletion. The selected
month supplies the edit form values; a single-month change keeps its category.
The month and following option allows a category change of the same type.

Cards and bill dates apply only to non-repeating purchases; monthly series keep
these rules. See [Cards and bill months](cards-and-bills.md).
