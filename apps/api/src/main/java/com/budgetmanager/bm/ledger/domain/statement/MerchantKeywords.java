package com.budgetmanager.bm.ledger.domain.statement;

import com.budgetmanager.bm.ledger.domain.TransactionType;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Well-known Brazilian merchants and words, mapped to the default category names seeded by
 * migrations V4, V7 and V8. Used to suggest a category for a merchant the user has never
 * categorized.
 *
 * <p>A keyword matches whole words of the description, and a single-word keyword of five letters or
 * more also matches the start of a word ({@code amazon} matches {@code amazonmktplc}). The longest
 * matching keyword wins, so {@code mercadolivre} beats {@code mercado} and {@code amazon prime}
 * beats {@code amazon}.
 *
 * <p>Some descriptions say what a line is before naming a merchant: {@code IOF de "Store"} is a tax
 * and {@code Estorno de "Store"} a refund, whatever the store. Those prefixes decide before any
 * merchant keyword.
 */
public final class MerchantKeywords {

  public record Match(String keyword, String categoryName, TransactionType type) {}

  private record Entry(
      List<String> words, String keyword, String categoryName, TransactionType type) {}

  private static final List<Entry> ENTRIES = new ArrayList<>();
  private static final List<Entry> PREFIXES = new ArrayList<>();

  static {
    prefix(TransactionType.EXPENSE, "Fees & taxes", "iof de", "iof", "anuidade", "juros", "multa");
    prefix(
        TransactionType.INCOME,
        "Refunds",
        "iof de volta",
        "estorno",
        "credito de",
        "desconto",
        "reembolso",
        "cashback");
    expense(
        "Groceries",
        "supermercado",
        "supermercados",
        "mercado",
        "mercearia",
        "atacadao",
        "atacadista",
        "assai",
        "carrefour",
        "hortifruti",
        "sacolao",
        "padaria",
        "panificadora",
        "acougue",
        "emporio",
        "pao de acucar",
        "makro");
    expense(
        "Restaurants",
        "restaurante",
        "lanchonete",
        "pizzaria",
        "burger",
        "burguer",
        "hamburgueria",
        "outback",
        "kfc",
        "mcdonalds",
        "burger king",
        "subway",
        "cafe",
        "cafeteria",
        "coffee",
        "starbucks",
        "churrascaria",
        "sushi",
        "boteco",
        "sorveteria",
        "doceria",
        "confeitaria",
        "gourmet",
        "bistro",
        "cantina");
    expense("Food delivery", "ifood", "ifd", "rappi", "ze delivery", "aiqfome", "james delivery");
    expense("Rent", "aluguel", "imobiliaria", "quintoandar", "quinto andar");
    expense("Condominium fee", "condominio", "condominial");
    expense(
        "Energy bill",
        "copel",
        "enel",
        "cemig",
        "cpfl",
        "celesc",
        "coelba",
        "energisa",
        "equatorial",
        "neoenergia",
        "energia eletrica");
    expense(
        "Water bill",
        "sanepar",
        "sabesp",
        "copasa",
        "cedae",
        "embasa",
        "caesb",
        "corsan",
        "compesa",
        "aguas de");
    expense(
        "House gas bill",
        "compagas",
        "comgas",
        "naturgy",
        "gas natural",
        "ultragaz",
        "liquigas",
        "supergasbras",
        "copagaz");
    expense(
        "Phone & internet",
        "vivo",
        "conta vivo",
        "tim",
        "claro",
        "nucel",
        "plano nucel",
        "internet",
        "telecom",
        "fibra");
    expense(
        "Transport",
        "uber",
        "99app",
        "99pop",
        "cabify",
        "metro",
        "onibus",
        "pedagio",
        "sem parar",
        "conectcar",
        "veloe");
    expense("Parking", "estacionamento", "estapar", "parking", "zona azul");
    expense(
        "Car",
        "posto",
        "auto posto",
        "shell",
        "ipiranga",
        "petrobras",
        "combustivel",
        "oficina",
        "autopecas",
        "lava car",
        "detran",
        "pneus");
    expense(
        "Pharmacy",
        "drogaria",
        "drogarias",
        "farmacia",
        "raia",
        "drogasil",
        "pague menos",
        "panvel");
    expense(
        "Health",
        "hospital",
        "clinica",
        "laboratorio",
        "unimed",
        "amil",
        "odonto",
        "dentista",
        "wellhub",
        "gympass",
        "smartfit",
        "smart fit",
        "academia",
        "saude");
    expense(
        "Pets", "petz", "cobasi", "petshop", "pet shop", "petlove", "veterinario", "veterinaria");
    expense(
        "Education",
        "escola",
        "colegio",
        "faculdade",
        "universidade",
        "curso",
        "udemy",
        "alura",
        "livraria");
    expense(
        "Shopping",
        "amazon",
        "amazonmktplc",
        "mercadolivre",
        "mercado livre",
        "shopee",
        "aliexpress",
        "magazine luiza",
        "magalu",
        "americanas",
        "casas bahia",
        "kabum",
        "renner",
        "riachuelo",
        "zara",
        "shein",
        "netshoes",
        "centauro",
        "decathlon",
        "leroy merlin",
        "tok stok",
        "lojas",
        "temu");
    expense(
        "Subscriptions",
        "netflix",
        "spotify",
        "youtubepremium",
        "youtube premium",
        "google one",
        "googleone",
        "disney",
        "walt disney",
        "hbo",
        "hbo max",
        "amazon prime",
        "amazon ad free",
        "prime video",
        "apple com",
        "icloud",
        "deezer",
        "globoplay",
        "paramount",
        "chatgpt",
        "openai",
        "microsoft",
        "adobe",
        "canva",
        "notion",
        "github",
        "clube livelo",
        "ifood club");
    expense(
        "Travel",
        "azul linhas",
        "azul",
        "gol linhas",
        "latam",
        "airbnb",
        "booking",
        "decolar",
        "123milhas",
        "hotel",
        "pousada",
        "hoteis");
    expense(
        "Leisure",
        "cinema",
        "cinemark",
        "cinepolis",
        "ingresso",
        "ingressos",
        "sympla",
        "eventim",
        "boliche",
        "teatro",
        "parque",
        "museu");
    expense("Gaming", "steam", "playstation", "xbox", "nintendo", "epic games", "riot games");
    expense(
        "Personal care",
        "salao",
        "barbearia",
        "barbeiro",
        "cabeleireiro",
        "cabeleireira",
        "manicure",
        "estetica",
        "boticario",
        "sephora",
        "perfumaria");
    expense("Gifts", "presente", "presentes", "floricultura", "flores");
    expense(
        "Fees & taxes",
        "iof",
        "anuidade",
        "tarifa",
        "juros",
        "multa",
        "encargos",
        "imposto",
        "darf",
        "ipva",
        "iptu",
        "ultravioleta");
    income(
        "Refunds",
        "estorno",
        "credito de",
        "iof de volta",
        "desconto",
        "reembolso",
        "cashback",
        "devolucao");
    income("Salary", "salario", "folha de pagamento", "proventos");
    income("Investments", "rendimento", "rendimentos", "dividendos", "resgate");
  }

  private MerchantKeywords() {}

  public static Optional<Match> match(String description, TransactionType type) {
    List<String> words = MerchantText.words(description);
    for (Entry prefix : PREFIXES) {
      if (prefix.type() == type
          && words.size() >= prefix.words().size()
          && words.subList(0, prefix.words().size()).equals(prefix.words())) {
        return Optional.of(new Match(prefix.keyword(), prefix.categoryName(), prefix.type()));
      }
    }
    Entry best = null;
    for (Entry entry : ENTRIES) {
      if (entry.type() == type
          && matches(words, entry.words())
          && (best == null || entry.keyword().length() > best.keyword().length())) {
        best = entry;
      }
    }
    return Optional.ofNullable(best)
        .map(entry -> new Match(entry.keyword(), entry.categoryName(), entry.type()));
  }

  /** The categories the dictionary can suggest, by type; all of them are seeded defaults. */
  public static Map<TransactionType, List<String>> categoryNames() {
    Map<TransactionType, List<String>> names = new java.util.EnumMap<>(TransactionType.class);
    List<Entry> all = new ArrayList<>(ENTRIES);
    all.addAll(PREFIXES);
    for (Entry entry : all) {
      List<String> list = names.computeIfAbsent(entry.type(), type -> new ArrayList<>());
      if (!list.contains(entry.categoryName())) {
        list.add(entry.categoryName());
      }
    }
    names.replaceAll((type, list) -> Collections.unmodifiableList(list));
    return Collections.unmodifiableMap(names);
  }

  private static boolean matches(List<String> words, List<String> keyword) {
    if (keyword.size() == 1) {
      String single = keyword.getFirst();
      return words.stream()
          .anyMatch(
              word -> word.equals(single) || (single.length() >= 5 && word.startsWith(single)));
    }
    for (int start = 0; start + keyword.size() <= words.size(); start++) {
      if (words.subList(start, start + keyword.size()).equals(keyword)) {
        return true;
      }
    }
    return false;
  }

  private static void expense(String categoryName, String... keywords) {
    add(TransactionType.EXPENSE, categoryName, keywords);
  }

  private static void income(String categoryName, String... keywords) {
    add(TransactionType.INCOME, categoryName, keywords);
  }

  /** Longest prefixes first, so {@code iof de volta} is checked before {@code iof de}. */
  private static void prefix(TransactionType type, String categoryName, String... prefixes) {
    for (String prefix : prefixes) {
      PREFIXES.add(new Entry(MerchantText.words(prefix), prefix, categoryName, type));
    }
    PREFIXES.sort(Comparator.comparingInt((Entry entry) -> entry.words().size()).reversed());
  }

  private static void add(TransactionType type, String categoryName, String... keywords) {
    for (String keyword : keywords) {
      ENTRIES.add(new Entry(MerchantText.words(keyword), keyword, categoryName, type));
    }
  }
}
