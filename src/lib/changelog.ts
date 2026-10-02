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
  | "zap"
  | "desktop"
  | "keyboard";

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
    version: "3.14.1",
    date: "2026-10-02",
    headline: "Aggiornamenti ancora più affidabili.",
    highlights: [
      {
        icon: "zap",
        title: "Aggiornamento automatico",
        description: "Da questa versione l'app scarica e installa da sola le novità: basta «Riavvia per aggiornare».",
      },
      {
        icon: "desktop",
        title: "Finestra sempre disponibile",
        description: "Se chiudi la finestra, riaprendo l'app dal Dock o dal Launchpad torna subito.",
      },
    ],
  },
  {
    version: "3.14.0",
    date: "2026-10-02",
    headline: "L'app si aggiorna da sola.",
    highlights: [
      {
        icon: "zap",
        title: "Aggiornamento automatico",
        description: "Le nuove versioni si scaricano in background: un clic su «Riavvia» e l'app si aggiorna da sola.",
      },
      {
        icon: "shield",
        title: "Download verificato",
        description: "Ogni aggiornamento è controllato con impronta digitale e firma prima dell'installazione.",
      },
      {
        icon: "desktop",
        title: "Nessuna reinstallazione",
        description: "Niente più file da scaricare e trascinare: se chiudi l'app, l'aggiornamento si installa da solo.",
      },
    ],
  },
  {
    version: "3.13.1",
    date: "2026-10-02",
    headline: "Rifiniture e correzioni.",
    highlights: [
      {
        icon: "sparkles",
        title: "Notifiche ridisegnate",
        description: "Nuova card per le notifiche in arrivo, con contorni puliti su computer e telefono.",
      },
      {
        icon: "desktop",
        title: "Tema sempre allineato",
        description: "Con il tema «Sistema» l'app passa da chiaro a scuro insieme al computer, senza ricaricare.",
      },
      {
        icon: "layout",
        title: "Impostazioni stabili",
        description: "Corretto lo scorrimento che portava la pagina troppo in basso.",
      },
    ],
  },
  {
    version: "3.13.0",
    date: "2026-10-02",
    headline: "La nuova app per Mac e Windows.",
    highlights: [
      {
        icon: "desktop",
        title: "Design nativo per Mac",
        description: "Sidebar traslucida, barra integrata e font di sistema: sembra un'app Apple.",
      },
      {
        icon: "shield",
        title: "Installazione sicura",
        description: "Risolto l'avviso «malware» di macOS: l'app ora ha una firma propria.",
      },
      {
        icon: "keyboard",
        title: "Menu e scorciatoie",
        description: "⌘N nuovo preventivo, ⌘1–7 per le sezioni, menu contestuale e badge nel Dock.",
      },
      {
        icon: "zap",
        title: "Più leggera",
        description: "Pacchetto ridotto di un terzo e avviso chiaro quando esce una nuova versione.",
      },
    ],
  },
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
