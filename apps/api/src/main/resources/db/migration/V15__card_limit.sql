ALTER TABLE t_card ADD COLUMN credit_limit NUMERIC(19,2) NULL CHECK (credit_limit > 0);
