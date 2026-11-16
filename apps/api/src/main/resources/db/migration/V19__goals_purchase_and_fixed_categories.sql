ALTER TABLE t_category ADD COLUMN fixed_cost boolean;
ALTER TABLE t_goal ADD COLUMN saved_at_purchase numeric(14,2) CHECK (saved_at_purchase >= 0);
ALTER TABLE t_goal ADD COLUMN actual_price numeric(14,2) CHECK (actual_price > 0);
