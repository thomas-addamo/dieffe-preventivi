// ─────────────────────────────────────────────────────────────────────────────
// Catalogo del listino: macro-categorie fisse, nell'ordine di un computo
// metrico (dalle demolizioni alle finiture). Ogni voce appartiene a UNA
// categoria e, opzionalmente, a una sottocategoria libera (es. Pavimenti ›
// Gres porcellanato). Il codice voce è gerarchico: PAV.02.05 =
// categoria · sottocategoria · voce.
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogCategory {
  name: string;
  prefix: string;
  /** Parole chiave per la classificazione senza AI. */
  keywords: string[];
}

export const CATALOG: CatalogCategory[] = [
  { name: "Cantiere e sicurezza", prefix: "CAN", keywords: ["cantiere", "sicurezza", "ponteggi", "ponteggio", "recinzion", "allestimento", "pulizia"] },
  { name: "Demolizioni e rimozioni", prefix: "DEM", keywords: ["demoli", "rimozion", "smontaggio", "rimuov", "spicconatura", "scrostatura"] },
  { name: "Scavi e movimenti terra", prefix: "SCA", keywords: ["scavo", "scavi", "rinterro", "sbancamento"] },
  { name: "Strutture e murature", prefix: "MUR", keywords: ["muratur", "muro", "tramezz", "laterizi", "cemento armato", "pilastr", "solaio", "architrave", "fondazion", "calcestruzzo", "blocchi"] },
  { name: "Massetti e sottofondi", prefix: "MAS", keywords: ["massetto", "sottofondo", "autolivellante", "caldana"] },
  { name: "Intonaci e rasature", prefix: "INT", keywords: ["intonac", "rasatur", "rasante", "stucc"] },
  { name: "Cartongesso e controsoffitti", prefix: "CAR", keywords: ["cartongesso", "controsoffitt", "contropare", "lastre"] },
  { name: "Isolamenti e cappotto", prefix: "ISO", keywords: ["cappotto", "isolament", "isolante", "coibentazion", "termico", "eps", "lana di roccia"] },
  { name: "Impermeabilizzazioni", prefix: "IMP", keywords: ["impermeabil", "guaina", "membrana"] },
  { name: "Pavimenti", prefix: "PAV", keywords: ["pavimen", "parquet", "laminato", "gres", "battiscopa", "piastrell"] },
  { name: "Rivestimenti", prefix: "RIV", keywords: ["rivestiment", "mosaico", "listelli"] },
  { name: "Tinteggiature e decorazioni", prefix: "TIN", keywords: ["tinteggiatur", "pittura", "idropittura", "verniciatur", "smalto", "decoraz"] },
  { name: "Serramenti e infissi", prefix: "SER", keywords: ["serrament", "infiss", "finestr", "porta", "porte", "persian", "tapparell", "portoncino", "zanzarier"] },
  { name: "Impianto idraulico", prefix: "IDR", keywords: ["idraulic", "tubazion", "scarico", "scarichi", "adduzion", "acqua"] },
  { name: "Bagni e sanitari", prefix: "BAG", keywords: ["bagno", "sanitari", "wc", "lavabo", "bidet", "doccia", "vasca", "rubinett", "miscelator"] },
  { name: "Impianto elettrico", prefix: "ELE", keywords: ["elettric", "punto luce", "prese", "quadro", "interruttor", "cavi", "illuminazion"] },
  { name: "Riscaldamento e climatizzazione", prefix: "TER", keywords: ["caldaia", "termosifon", "radiator", "riscaldament", "climatizz", "condizionator", "pompa di calore", "radiante"] },
  { name: "Coperture e lattonerie", prefix: "COP", keywords: ["copertur", "tetto", "tegol", "coppi", "grondai", "lattoneri", "pluvial", "lucernari"] },
  { name: "Facciate ed esterni", prefix: "EST", keywords: ["facciat", "esterno", "esterni", "balcon", "terrazz", "giardin", "recinzion", "cortile"] },
  { name: "Smaltimento e trasporti", prefix: "SMA", keywords: ["smaltiment", "trasport", "discarica", "macerie", "conferimento", "cassone"] },
  { name: "Noli e attrezzature", prefix: "NOL", keywords: ["nolo", "noleggio", "piattaforma", "gru", "attrezzatur", "autocarro"] },
  { name: "Opere varie", prefix: "VAR", keywords: [] },
];

export const DEFAULT_CATEGORY = "Opere varie";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Riporta una categoria qualsiasi (vecchia, scritta a mano, dell'AI) al catalogo. */
export function canonicalCategory(raw: string | null | undefined, description = ""): string {
  const r = norm(raw ?? "");
  const exact = r && CATALOG.find((c) => norm(c.name) === r);
  if (exact) return exact.name;
  // Parole chiave: quelle nella vecchia categoria valgono doppio.
  const d = norm(description);
  let best: { name: string; score: number } | null = null;
  for (const c of CATALOG) {
    const score = c.keywords.reduce(
      (n, k) => n + (r.includes(k) ? 2 : 0) + (d.includes(k) ? 1 : 0),
      0
    );
    if (score > 0 && (!best || score > best.score)) best = { name: c.name, score };
  }
  return best?.name ?? DEFAULT_CATEGORY;
}

export function isCatalogCategory(name: string | null | undefined): boolean {
  return !!name && CATALOG.some((c) => c.name === name);
}

export function categoryPrefix(name: string | null | undefined): string {
  return CATALOG.find((c) => c.name === name)?.prefix ?? "VAR";
}

export function categoryOrder(name: string | null | undefined): number {
  const i = CATALOG.findIndex((c) => c.name === name);
  return i === -1 ? CATALOG.length : i;
}

/** Ordine del catalogo: categoria › sottocategoria › descrizione. */
export function sortCatalog<T extends { category: string | null; subcategory: string | null; description: string }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) =>
      categoryOrder(a.category) - categoryOrder(b.category) ||
      (a.subcategory ?? "\uffff").localeCompare(b.subcategory ?? "\uffff", "it") ||
      a.description.localeCompare(b.description, "it")
  );
}

