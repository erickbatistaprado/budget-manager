-- Categories belong to a user. Every existing category is copied to every user and
-- each transaction is moved to its owner's copy, so no user loses a category and
-- no transaction keeps pointing at another user's row.
ALTER TABLE t_category ADD COLUMN user_id uuid;

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 't_category'::regclass
      AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE t_category DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

CREATE TEMPORARY TABLE category_copy ON COMMIT DROP AS
SELECT
  c.id AS old_id,
  u.id AS user_id,
  gen_random_uuid() AS new_id
FROM
  t_category c
  CROSS JOIN t_user u;

INSERT INTO
  t_category (id, created_at, name, transaction_type, updated_at, user_id)
SELECT
  cc.new_id,
  c.created_at,
  c.name,
  c.transaction_type,
  now(),
  cc.user_id
FROM
  category_copy cc
  JOIN t_category c ON c.id = cc.old_id;

UPDATE t_transaction t
SET
  category_id = cc.new_id
FROM
  category_copy cc
WHERE
  cc.old_id = t.category_id
  AND cc.user_id = t.user_id;

DELETE FROM t_category
WHERE
  user_id IS NULL;

ALTER TABLE t_category
ALTER COLUMN user_id SET NOT NULL,
ADD CONSTRAINT t_category_user_id_fkey FOREIGN KEY (user_id) REFERENCES t_user (id),
ADD CONSTRAINT t_category_user_type_name_key UNIQUE (user_id, transaction_type, name);

-- Refresh tokens: one row per signed-in device, stored as a SHA-256 hash.
-- Existing sessions are dropped, so everyone signs in once more.
DELETE FROM t_refresh_token;

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 't_refresh_token'::regclass
      AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE t_refresh_token DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

ALTER TABLE t_refresh_token
RENAME COLUMN token TO token_hash;

ALTER TABLE t_refresh_token
ALTER COLUMN token_hash TYPE varchar(64),
ALTER COLUMN user_id SET NOT NULL,
ADD CONSTRAINT t_refresh_token_token_hash_key UNIQUE (token_hash);

CREATE INDEX t_refresh_token_user_id_idx ON t_refresh_token (user_id);

-- Every money column uses the same precision.
ALTER TABLE t_transaction
ALTER COLUMN total_value TYPE numeric(19, 2);

ALTER TABLE t_installment
ALTER COLUMN amount TYPE numeric(19, 2);

-- Listing transactions filters by user and date on every request.
CREATE INDEX t_transaction_user_id_date_idx ON t_transaction (user_id, date);

CREATE INDEX t_installment_transaction_id_due_date_idx ON t_installment (transaction_id, due_date);
