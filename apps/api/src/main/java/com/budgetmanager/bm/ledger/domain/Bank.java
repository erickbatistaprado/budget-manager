package com.budgetmanager.bm.ledger.domain;

public enum Bank {
  NUBANK("Nubank"),
  ITAU("Itaú"),
  BRADESCO("Bradesco"),
  BANCO_DO_BRASIL("Banco do Brasil"),
  CAIXA("Caixa"),
  SANTANDER("Santander"),
  INTER("Inter"),
  C6("C6 Bank"),
  BTG_PACTUAL("BTG Pactual"),
  XP("XP"),
  PORTO("Porto Bank / Porto Seguro"),
  MERCADO_PAGO("Mercado Pago"),
  PICPAY("PicPay"),
  PAGBANK("PagBank"),
  SICREDI("Sicredi"),
  SICOOB("Sicoob"),
  BANRISUL("Banrisul"),
  NEON("Neon"),
  OTHER("Other");
  private final String displayName;

  Bank(String displayName) {
    this.displayName = displayName;
  }

  public String getDisplayName() {
    return displayName;
  }
}
