CREATE TABLE t_financing (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    user_id UUID NOT NULL REFERENCES t_user(id),
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    lender VARCHAR(255),
    purchase_price NUMERIC(19,2),
    down_payment NUMERIC(19,2),
    iof NUMERIC(19,2),
    registration NUMERIC(19,2),
    valuation_fee NUMERIC(19,2),
    category_id UUID NOT NULL REFERENCES t_category(id),
    payment_method VARCHAR(32),
    account_id UUID REFERENCES t_account(id) ON DELETE SET NULL,
    system VARCHAR(32) NOT NULL,
    amount NUMERIC(19,2) NOT NULL,
    rate NUMERIC(60,40) NOT NULL,
    rate_period VARCHAR(32) NOT NULL,
    term INTEGER NOT NULL,
    first_due_date DATE NOT NULL,
    stated_installment NUMERIC(19,2),
    insurance NUMERIC(19,2) NOT NULL,
    fees NUMERIC(19,2) NOT NULL,
    correction_index VARCHAR(32) NOT NULL DEFAULT 'NONE',
    version_marker BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE t_financing_change (
    id UUID PRIMARY KEY,
    financing_id UUID NOT NULL REFERENCES t_financing(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('EXTRA_PAYMENT', 'PAID_AMOUNT', 'BALANCE_SYNC', 'DUE_DAY')),
    date DATE,
    installment_number INTEGER,
    amount NUMERIC(19,2),
    option VARCHAR(32),
    due_day INTEGER,
    UNIQUE (financing_id, sequence)
);
ALTER TABLE t_transaction ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE t_transaction ADD COLUMN financing_id UUID REFERENCES t_financing(id);
ALTER TABLE t_transaction ADD CONSTRAINT ck_transaction_financing_source
    CHECK ((source = 'FINANCING' AND financing_id IS NOT NULL) OR (source = 'MANUAL' AND financing_id IS NULL));
CREATE INDEX ix_financing_owner ON t_financing(user_id);
CREATE INDEX ix_transaction_financing ON t_transaction(financing_id);
ALTER TABLE t_transaction DROP CONSTRAINT t_transaction_installment_numbers_check;
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_installment_numbers_check
    CHECK (installment_numbers <= 500 AND (installment_numbers >= 2 OR (source = 'FINANCING' AND installment_numbers = 1)));
