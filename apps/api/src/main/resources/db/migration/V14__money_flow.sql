ALTER TABLE t_card ADD COLUMN payment_account_id UUID REFERENCES t_account(id) ON DELETE SET NULL;
ALTER TABLE t_card ADD COLUMN funding_account_id UUID REFERENCES t_account(id) ON DELETE SET NULL;
ALTER TABLE t_card ADD CONSTRAINT ck_card_funding CHECK (funding_account_id IS NULL OR (payment_account_id IS NOT NULL AND funding_account_id <> payment_account_id));
CREATE TABLE t_movement (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES t_user(id), kind VARCHAR(32) NOT NULL,
 date DATE NOT NULL, amount NUMERIC(19,2) NOT NULL CHECK (amount > 0),
 from_account_id UUID REFERENCES t_account(id), to_account_id UUID REFERENCES t_account(id),
 card_id UUID REFERENCES t_card(id), bill_due_date DATE,
 saving_id UUID REFERENCES t_saving(id) ON DELETE CASCADE, opening BOOLEAN NOT NULL DEFAULT false,
 notes VARCHAR(4000), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT ck_movement_kind CHECK (
 (kind = 'TRANSFER' AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL AND from_account_id <> to_account_id AND saving_id IS NULL AND NOT opening AND ((card_id IS NULL AND bill_due_date IS NULL) OR (card_id IS NOT NULL AND bill_due_date IS NOT NULL))) OR
 (kind = 'CARD_BILL_PAYMENT' AND from_account_id IS NOT NULL AND to_account_id IS NULL AND card_id IS NOT NULL AND bill_due_date IS NOT NULL AND saving_id IS NULL AND NOT opening) OR
 (kind = 'INVESTMENT' AND saving_id IS NOT NULL AND to_account_id IS NULL AND card_id IS NULL AND bill_due_date IS NULL AND ((opening AND from_account_id IS NULL) OR (NOT opening AND from_account_id IS NOT NULL))) OR
 (kind = 'REDEMPTION' AND saving_id IS NOT NULL AND to_account_id IS NOT NULL AND from_account_id IS NULL AND card_id IS NULL AND bill_due_date IS NULL AND NOT opening))
);
CREATE UNIQUE INDEX ux_movement_bill ON t_movement(card_id, bill_due_date) WHERE kind = 'CARD_BILL_PAYMENT';
CREATE UNIQUE INDEX ux_movement_funding ON t_movement(card_id, bill_due_date) WHERE kind = 'TRANSFER' AND card_id IS NOT NULL;
CREATE INDEX ix_movement_owner_date ON t_movement(user_id, date);
CREATE TABLE t_account_balance (
 id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES t_account(id) ON DELETE CASCADE,
 date DATE NOT NULL, balance NUMERIC(19,2) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(account_id, date)
);
CREATE TABLE t_saving_valuation (
 id UUID PRIMARY KEY, saving_id UUID NOT NULL REFERENCES t_saving(id) ON DELETE CASCADE,
 date DATE NOT NULL, value NUMERIC(19,2) NOT NULL CHECK (value >= 0), UNIQUE(saving_id, date)
);
INSERT INTO t_movement(id, user_id, kind, date, amount, saving_id, opening)
 SELECT gen_random_uuid(), user_id, 'INVESTMENT', COALESCE((created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE), amount, id, true FROM t_saving WHERE amount > 0;

CREATE OR REPLACE FUNCTION check_transaction_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE income BOOLEAN;
BEGIN
 SELECT transaction_type = 'INCOME' INTO income FROM t_category WHERE id = NEW.category_id;
 IF income AND NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('PIX', 'BANK_TRANSFER', 'CASH', 'OTHER', 'CREDIT_CARD') THEN
  RAISE EXCEPTION 'Income supports Pix, bank transfer, cash, other or card credits' USING ERRCODE = '23514';
 END IF;
 IF NEW.account_id IS NOT NULL AND (NEW.payment_method IS NULL OR (NOT income AND NEW.payment_method IN ('CASH', 'OTHER'))) THEN
  RAISE EXCEPTION 'Payment method does not support an account' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION clear_deleted_payment_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE t_card SET funding_account_id = NULL WHERE payment_account_id = OLD.id;
 RETURN OLD;
END $$;
CREATE TRIGGER t_account_clear_card_funding BEFORE DELETE ON t_account FOR EACH ROW EXECUTE FUNCTION clear_deleted_payment_account();
