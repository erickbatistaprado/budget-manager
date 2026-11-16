ALTER TABLE t_transaction DROP CONSTRAINT t_transaction_card_non_repeating;
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_card_repeats_monthly
  CHECK (card_id IS NULL OR repeats IS NULL OR repeats IN ('NONE', 'MONTHLY'));
