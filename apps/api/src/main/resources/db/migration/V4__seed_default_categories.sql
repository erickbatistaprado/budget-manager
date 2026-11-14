-- The categories every user starts with. Registration copies them to each new
-- user; to change the defaults, add a migration that edits this table.
CREATE TABLE t_default_category (
  name varchar(255) NOT NULL,
  transaction_type varchar(255) NOT NULL,
  CONSTRAINT t_default_category_pkey PRIMARY KEY (transaction_type, name),
  CONSTRAINT t_default_category_transaction_type_check CHECK (
    transaction_type IN ('INCOME', 'EXPENSE')
  )
);

INSERT INTO
  t_default_category (name, transaction_type)
VALUES
  ('Groceries', 'EXPENSE'),
  ('Restaurants', 'EXPENSE'),
  ('Food delivery', 'EXPENSE'),
  ('Housing', 'EXPENSE'),
  ('Utilities', 'EXPENSE'),
  ('Phone & internet', 'EXPENSE'),
  ('Transport', 'EXPENSE'),
  ('Car', 'EXPENSE'),
  ('Health', 'EXPENSE'),
  ('Pets', 'EXPENSE'),
  ('Education', 'EXPENSE'),
  ('Shopping', 'EXPENSE'),
  ('Subscriptions', 'EXPENSE'),
  ('Travel', 'EXPENSE'),
  ('Leisure', 'EXPENSE'),
  ('Gifts', 'EXPENSE'),
  ('Fees & taxes', 'EXPENSE'),
  ('Other', 'EXPENSE'),
  ('Salary', 'INCOME'),
  ('Freelance', 'INCOME'),
  ('Investments', 'INCOME'),
  ('Refunds', 'INCOME'),
  ('Other', 'INCOME');

-- Existing users get every default they do not have yet (names compared
-- without case), so nothing they created is duplicated.
INSERT INTO
  t_category (id, created_at, updated_at, name, transaction_type, user_id)
SELECT
  gen_random_uuid(),
  now(),
  now(),
  d.name,
  d.transaction_type,
  u.id
FROM
  t_default_category d
  CROSS JOIN t_user u
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      t_category c
    WHERE
      c.user_id = u.id
      AND c.transaction_type = d.transaction_type
      AND lower(c.name) = lower(d.name)
  );
