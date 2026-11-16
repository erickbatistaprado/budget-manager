ALTER TABLE t_user ADD COLUMN main_account_id uuid REFERENCES t_account(id) ON DELETE SET NULL;
ALTER TABLE t_user ADD COLUMN goal_monthly_pace numeric(14,2) CHECK (goal_monthly_pace >= 0);
CREATE TABLE t_goal (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES t_user(id) ON DELETE CASCADE,
 name varchar(255) NOT NULL,
 price numeric(14,2) NOT NULL CHECK (price > 0),
 kind varchar(16) NOT NULL CHECK (kind IN ('NEED','WANT')),
 link varchar(2000), notes varchar(4000), target_date date,
 position integer NOT NULL CHECK (position > 0),
 monthly_amount numeric(14,2) CHECK (monthly_amount >= 0),
 saving_id uuid REFERENCES t_saving(id) ON DELETE SET NULL,
 status varchar(16) NOT NULL CHECK (status IN ('ACTIVE','ACHIEVED','CANCELLED')),
 achieved_at date, expense_transaction_id uuid REFERENCES t_transaction(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_goal_owner_position ON t_goal(user_id, position);
CREATE TABLE t_goal_allocation (
 id uuid PRIMARY KEY,
 goal_id uuid NOT NULL REFERENCES t_goal(id) ON DELETE CASCADE,
 date date NOT NULL, amount numeric(14,2) NOT NULL CHECK (amount <> 0),
 movement_id uuid REFERENCES t_movement(id) ON DELETE SET NULL
);
CREATE INDEX ix_goal_allocation_goal ON t_goal_allocation(goal_id);
