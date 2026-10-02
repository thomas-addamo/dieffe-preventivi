// ─────────────────────────────────────────────────────────────────────────────
// Novità mostrate nel banner "Novità" in cima all'app (WhatsNewBanner).
//
// Ad OGNI rilascio con modifiche visibili agli utenti aggiungere in TESTA una
// voce con la stessa `version` di APP_VERSION (src/lib/version.ts). Il banner
// compare una volta per versione e resta chiuso dopo la X.
// ─────────────────────────────────────────────────────────────────────────────

export type ChangelogIcon =
  | "format"
  | "pdf"
  | "layout"
  | "settings"
  | "sparkles"
  | "shield"
  | "zap";

export interface ChangelogHighlight {
  icon: ChangelogIcon;
  title: string;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  /** Data di rilascio ISO (YYYY-MM-DD). */
  date: string;
  /** Frase di lancio, breve. */
  headline: string;
  highlights: ChangelogHighlight[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "3.12.0",
    date: "2026-10-02",
    headline: "Scrivi meglio, condividi ovunque.",
    highlights: [
      {
        icon: "format",
        title: "Descrizioni formattate",
        description: "Grassetto, corsivo, sottolineato ed elenchi direttamente nelle voci. Anche nel PDF.",
      },
      {
        icon: "layout",
        title: "Più spazio al testo",
        description: "La descrizione ora usa tutta la larghezza della riga: niente più colonne strette.",
      },
      {
        icon: "pdf",
        title: "PDF da iPhone",
        description: "Salva su File, invia su WhatsApp o via mail con un tocco.",
      },
      {
        icon: "settings",
        title: "Scrittura libera",
        description: "Listino e suggerimenti di prezzo si possono spegnere da Impostazioni.",
      },
    ],
  },
];

export function getChangelogFor(version: string): ChangelogEntry | undefined {
  return CHANGELOG.find((e) => e.version === version);
}
