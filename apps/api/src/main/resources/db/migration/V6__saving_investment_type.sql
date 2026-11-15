-- Investments get their kind (Tesouro Direto, CDB, ações, FIIs, cripto...),
-- so the allocation can be split by type. Existing investments start as
-- OTHER_INVESTMENT and can be reclassified.
ALTER TABLE t_saving
ADD COLUMN investment_type varchar(40);

UPDATE t_saving
SET
  investment_type = 'OTHER_INVESTMENT'
WHERE
  location = 'INVESTMENT';

ALTER TABLE t_saving
ADD CONSTRAINT t_saving_investment_type_check CHECK (
  investment_type IN (
    'TESOURO_DIRETO',
    'CDB',
    'LCI_LCA',
    'CREDIT_BONDS',
    'STOCKS',
    'REAL_ESTATE_FUNDS',
    'ETFS',
    'BDRS',
    'CRYPTO',
    'INVESTMENT_FUNDS',
    'PRIVATE_PENSION',
    'FOREIGN',
    'OTHER_INVESTMENT'
  )
),
ADD CONSTRAINT t_saving_investment_type_location_check CHECK (
  (location = 'INVESTMENT') = (investment_type IS NOT NULL)
);
