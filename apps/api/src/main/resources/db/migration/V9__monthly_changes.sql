ALTER TABLE t_transaction ADD COLUMN repeat_until date;
ALTER TABLE t_transaction ADD CONSTRAINT transaction_repeat_until_month CHECK (
  repeat_until IS NULL OR (extract(day FROM repeat_until) = 1 AND repeat_until >= date_trunc('month', date)::date)
);
CREATE TABLE t_transaction_month (
  id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES t_transaction(id) ON DELETE CASCADE,
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  amount numeric(19,2) CHECK (amount > 0),
  date date,
  notes varchar(255),
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamp(6) with time zone,
  updated_at timestamp(6) with time zone,
  UNIQUE (transaction_id, month),
  CHECK (date IS NULL OR date_trunc('month', date)::date = month)
);
