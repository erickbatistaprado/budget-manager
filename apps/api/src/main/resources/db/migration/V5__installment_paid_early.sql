-- An installment paid before its month (a card prepayment) moves to the day it
-- was paid and keeps that day when the transaction is edited.
ALTER TABLE t_installment
ADD COLUMN paid_early boolean NOT NULL DEFAULT false;
