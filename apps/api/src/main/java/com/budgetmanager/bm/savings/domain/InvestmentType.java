package com.budgetmanager.bm.savings.domain;

/** The kinds of investment common in Brazil, each in its allocation group. */
public enum InvestmentType {
  /** Tesouro Selic, IPCA+ and Prefixado. */
  TESOURO_DIRETO(InvestmentGroup.FIXED_INCOME),
  /** CDB and RDB. */
  CDB(InvestmentGroup.FIXED_INCOME),
  /** LCI and LCA, exempt from income tax. */
  LCI_LCA(InvestmentGroup.FIXED_INCOME),
  /** Debêntures, CRI and CRA. */
  CREDIT_BONDS(InvestmentGroup.FIXED_INCOME),
  /** Ações. */
  STOCKS(InvestmentGroup.VARIABLE_INCOME),
  /** Fundos imobiliários (FIIs). */
  REAL_ESTATE_FUNDS(InvestmentGroup.VARIABLE_INCOME),
  ETFS(InvestmentGroup.VARIABLE_INCOME),
  BDRS(InvestmentGroup.VARIABLE_INCOME),
  CRYPTO(InvestmentGroup.VARIABLE_INCOME),
  /** Fundos de investimento: multimercado, renda fixa, ações. */
  INVESTMENT_FUNDS(InvestmentGroup.FUNDS_AND_PENSION),
  /** Previdência privada: PGBL and VGBL. */
  PRIVATE_PENSION(InvestmentGroup.FUNDS_AND_PENSION),
  /** Investments abroad. */
  FOREIGN(InvestmentGroup.OTHER),
  OTHER_INVESTMENT(InvestmentGroup.OTHER);

  private final InvestmentGroup group;

  InvestmentType(InvestmentGroup group) {
    this.group = group;
  }

  public InvestmentGroup group() {
    return group;
  }
}
