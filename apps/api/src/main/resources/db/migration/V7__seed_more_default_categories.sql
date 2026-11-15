-- More categories every user starts with.
INSERT INTO
  t_default_category (name, transaction_type)
VALUES
  ('Pharmacy', 'EXPENSE'),
  ('Personal care', 'EXPENSE'),
  ('Parking', 'EXPENSE'),
  ('Gaming', 'EXPENSE');

-- Existing users get the new defaults they do not have yet (names compared
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
  d.name IN ('Pharmacy', 'Personal care', 'Parking', 'Gaming')
  AND d.transaction_type = 'EXPENSE'
  AND NOT EXISTS (
    SELECT
      1
    FROM
      t_category c
    WHERE
      c.user_id = u.id
      AND c.transaction_type = d.transaction_type
      AND lower(c.name) = lower(d.name)
  );
