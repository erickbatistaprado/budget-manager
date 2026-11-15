CREATE TABLE t_card (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES t_user(id),
    name VARCHAR(255) NOT NULL,
    closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX t_card_user_name_key ON t_card (user_id, lower(name));
ALTER TABLE t_transaction ADD COLUMN card_id UUID REFERENCES t_card(id) ON DELETE SET NULL;
ALTER TABLE t_transaction ADD COLUMN bill_due_date DATE;
CREATE INDEX t_transaction_card_idx ON t_transaction(card_id);
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_card_non_repeating CHECK (card_id IS NULL OR repeats = 'NONE');
