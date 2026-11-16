ALTER TABLE t_card ADD COLUMN bill_payment_method VARCHAR(32);
ALTER TABLE t_card ADD CONSTRAINT ck_card_bill_payment_method CHECK (bill_payment_method IS NULL OR bill_payment_method IN ('PIX', 'BANK_TRANSFER', 'BOLETO', 'AUTOMATIC_DEBIT', 'OTHER'));
ALTER TABLE t_movement ADD COLUMN payment_method VARCHAR(32);
ALTER TABLE t_movement ADD CONSTRAINT ck_movement_payment_method CHECK (payment_method IS NULL OR
 (kind = 'CARD_BILL_PAYMENT' AND payment_method IN ('PIX', 'BANK_TRANSFER', 'BOLETO', 'AUTOMATIC_DEBIT', 'OTHER')) OR
 (kind = 'TRANSFER' AND payment_method IN ('PIX', 'BANK_TRANSFER', 'OTHER')));
