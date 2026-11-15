package com.budgetmanager.bm.ledger.domain.statement;

import static org.assertj.core.api.Assertions.assertThat;

import com.budgetmanager.bm.ledger.domain.TransactionType;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class MerchantKeywordsTest {

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "Netflix.Com | Subscriptions | netflix",
        "Mercadolivre*Seller | Shopping | mercadolivre",
        "SUPERMERCADO BOA VISTA | Groceries | supermercado",
        "Amazonmktplc*Store | Shopping | amazonmktplc",
        "Amazon Ad Free For Pri | Subscriptions | amazon ad free",
        "AMAZON PRIME BR | Subscriptions | amazon prime",
        "Ifd*Ifood Club | Subscriptions | ifood club",
        "iFood - NuPay | Food delivery | ifood",
        "IFD*SOME RESTAURANT | Food delivery | ifd",
        "Ebn *Playstation | Gaming | playstation",
        "Google Google*One 01m | Subscriptions | google one",
        "IOF de \"Some Store\" | Fees & taxes | iof de",
        "IOF de \"Wl *Steam Purchase\" | Fees & taxes | iof de",
        "IOF de \"Openai *Chatgpt Subscr\" | Fees & taxes | iof de",
        "DROGARIA CENTRAL | Pharmacy | drogaria",
        "Estapar Shopping | Parking | estapar",
        "COPEL DIS SA | Energy bill | copel",
        "SANEPAR CURITIBA | Water bill | sanepar",
        "COMPAGAS | House gas bill | compagas",
        "CONDOMINIO EDIFICIO SOL | Condominium fee | condominio",
        "QUINTOANDAR ALUGUEL | Rent | quintoandar",
        "BARBEARIA DO CENTRO | Personal care | barbearia",
        "SMARTFIT UNIDADE 12 | Health | smartfit",
        "Uber *Trip | Transport | uber"
      })
  void suggestsExpenseCategories(String description, String category, String keyword) {
    assertThat(MerchantKeywords.match(description, TransactionType.EXPENSE))
        .contains(new MerchantKeywords.Match(keyword, category, TransactionType.EXPENSE));
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "Estorno de \"Some Store\" | Refunds",
        "IOF de volta de Some Store | Refunds",
        "Crédito de \"Cloud\" (Cloud) | Refunds",
        "Desconto Antecipação Bike Shop | Refunds"
      })
  void suggestsIncomeCategoriesForCredits(String description, String category) {
    assertThat(MerchantKeywords.match(description, TransactionType.INCOME))
        .hasValueSatisfying(match -> assertThat(match.categoryName()).isEqualTo(category));
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {"Jc Store", "Acme Comercio Ltda", "65105471someone", "Bike Shop - Parcela 2/3"})
  void staysQuietForUnknownMerchants(String description) {
    assertThat(MerchantKeywords.match(description, TransactionType.EXPENSE)).isEmpty();
  }

  @Test
  void refundsOfAKnownMerchantStayRefunds() {
    assertThat(MerchantKeywords.match("Estorno de \"Netflix.Com\"", TransactionType.INCOME))
        .hasValueSatisfying(match -> assertThat(match.categoryName()).isEqualTo("Refunds"));
    assertThat(MerchantKeywords.match("IOF de volta de Wl *Steam Purchase", TransactionType.INCOME))
        .hasValueSatisfying(match -> assertThat(match.keyword()).isEqualTo("iof de volta"));
  }

  @Test
  void neverMatchesPartOfAShortWord() {
    assertThat(MerchantKeywords.match("TIMBER YARD", TransactionType.EXPENSE)).isEmpty();
    assertThat(MerchantKeywords.match("Tim Pos", TransactionType.EXPENSE))
        .hasValueSatisfying(
            match -> assertThat(match.categoryName()).isEqualTo("Phone & internet"));
  }

  @Test
  void onlySuggestsSeededDefaultCategories() throws IOException {
    Set<String> seeded = seededDefaults();

    for (Map.Entry<TransactionType, List<String>> entry :
        MerchantKeywords.categoryNames().entrySet()) {
      for (String name : entry.getValue()) {
        assertThat(seeded).contains(entry.getKey() + ":" + name);
      }
    }
  }

  private static Set<String> seededDefaults() throws IOException {
    Set<String> defaults = new HashSet<>();
    for (String file :
        List.of(
            "V4__seed_default_categories.sql",
            "V7__seed_more_default_categories.sql",
            "V8__seed_home_bill_categories.sql")) {
      try (InputStream migration =
          MerchantKeywordsTest.class.getResourceAsStream("/db/migration/" + file)) {
        String sql = new String(migration.readAllBytes(), StandardCharsets.UTF_8);
        Matcher row = Pattern.compile("\\('([^']+)', '(EXPENSE|INCOME)'\\)").matcher(sql);
        while (row.find()) {
          defaults.add(row.group(2) + ":" + row.group(1));
        }
      }
    }
    return defaults;
  }
}
