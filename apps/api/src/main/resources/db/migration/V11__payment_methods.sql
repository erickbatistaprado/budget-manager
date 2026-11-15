ALTER TABLE t_card ADD COLUMN bank VARCHAR(32);
UPDATE t_card SET bank = CASE
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%nubank%' THEN 'NUBANK'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%itau%' THEN 'ITAU'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%bradesco%' THEN 'BRADESCO'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%banco do brasil%' THEN 'BANCO_DO_BRASIL'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%caixa%' THEN 'CAIXA'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%santander%' THEN 'SANTANDER'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%inter%' THEN 'INTER'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%c6%' THEN 'C6'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%btg pactual%' THEN 'BTG_PACTUAL'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ~ '\mxp\M' THEN 'XP'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%porto%' THEN 'PORTO'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%mercado pago%' THEN 'MERCADO_PAGO'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%picpay%' THEN 'PICPAY'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%pagbank%' THEN 'PAGBANK'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%sicredi%' THEN 'SICREDI'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%sicoob%' THEN 'SICOOB'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%banrisul%' THEN 'BANRISUL'
 WHEN translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%neon%' THEN 'NEON'
 ELSE 'OTHER' END;
ALTER TABLE t_card ALTER COLUMN bank SET NOT NULL;
CREATE TABLE t_account (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES t_user(id), name VARCHAR(255) NOT NULL, bank VARCHAR(32) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX t_account_user_name_key ON t_account(user_id, lower(name));
ALTER TABLE t_transaction ADD COLUMN payment_method VARCHAR(32);
ALTER TABLE t_transaction ADD COLUMN account_id UUID REFERENCES t_account(id) ON DELETE SET NULL;
CREATE INDEX t_transaction_account_idx ON t_transaction(account_id);
UPDATE t_transaction SET payment_method = 'CREDIT_CARD' WHERE card_id IS NOT NULL;
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_payment_method_check CHECK (payment_method IN ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'AUTOMATIC_DEBIT', 'CASH', 'OTHER'));
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_payment_card_check CHECK ((card_id IS NOT NULL) = (payment_method IS NOT DISTINCT FROM 'CREDIT_CARD') AND (payment_method IS DISTINCT FROM 'CREDIT_CARD' OR account_id IS NULL));
CREATE FUNCTION check_transaction_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE income BOOLEAN;
BEGIN
 SELECT transaction_type = 'INCOME' INTO income FROM t_category WHERE id = NEW.category_id;
 IF income AND NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('PIX', 'BANK_TRANSFER', 'CASH', 'OTHER') THEN
  RAISE EXCEPTION 'Income supports Pix, bank transfer, cash or other' USING ERRCODE = '23514';
 END IF;
 IF NEW.account_id IS NOT NULL AND (NEW.payment_method IS NULL OR (NOT income AND NEW.payment_method IN ('CASH', 'OTHER'))) THEN
  RAISE EXCEPTION 'Payment method does not support an account' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER t_transaction_payment_check BEFORE INSERT OR UPDATE ON t_transaction FOR EACH ROW EXECUTE FUNCTION check_transaction_payment();
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_payment_account_check CHECK (account_id IS NULL OR (payment_method IS NOT NULL AND payment_method <> 'CREDIT_CARD'));
CREATE FUNCTION clear_deleted_card_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE t_transaction SET card_id = NULL, payment_method = NULL WHERE card_id = OLD.id;
 RETURN OLD;
END $$;
CREATE TRIGGER t_card_clear_payment BEFORE DELETE ON t_card FOR EACH ROW EXECUTE FUNCTION clear_deleted_card_payment();
