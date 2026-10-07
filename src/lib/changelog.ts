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
    version: "3.18.0",
    date: "2026-10-07",
    headline: "Lavori extra, una dashboard tutta tua e l'Aiuto sempre a portata.",
    highlights: [
      {
        icon: "layout",
        title: "Lavori extra",
        description: "Lavorazioni aggiuntive in un preventivo separato, legato all'originale, con prezzo isolato e PDF marcato EXTRA.",
      },
      {
        icon: "sparkles",
        title: "Dashboard personale",
        description: "Saluto, cosa hai lasciato in sospeso e consigli dell'AI in base all'ora e al tuo lavoro.",
      },
      {
        icon: "zap",
        title: "Aiuto",
        description: "Chiedi all'assistente come si fa, oppure scrivi all'amministratore: riceve la tua richiesta come notifica.",
      },
      {
        icon: "desktop",
        title: "Icona Mac più grande",
        description: "Il logo Liquid Glass ora riempie meglio l'icona nel Dock.",
      },
    ],
  },
  {
    version: "3.17.1",
    date: "2026-10-07",
    headline: "Icona Liquid Glass su Mac.",
    highlights: [
      {
        icon: "desktop",
        title: "Nuova icona per macOS",
        description: "Il logo Dieffe in vetro, a strati, come le app di sistema di macOS 26, anche in versione scura e trasparente.",
      },
    ],
  },
  {
    version: "3.17.0",
    date: "2026-10-06",
    headline: "Un listino che si mette in ordine da solo.",
    highlights: [
      {
        icon: "sparkles",
        title: "Riordino automatico",
        description: "Ogni notte l'AI unisce i doppioni ed elimina le voci che non usi più da mesi. Le voci fissate restano.",
      },
      {
        icon: "layout",
        title: "Catalogo a categorie",
        description: "Categoria › sottocategoria › voce, con codici gerarchici (PAV.02.05) e quante volte ogni voce è stata usata.",
      },
      {
        icon: "zap",
        title: "Nuovo archivio preventivi",
        description: "In dashboard un elenco a tasti larghi con cliente, data, stato e importo, uguale su computer e telefono.",
      },
    ],
  },
  {
    version: "3.16.0",
    date: "2026-10-06",
    headline: "Comunicazioni su carta intestata, e un'app più coerente.",
    highlights: [
      {
        icon: "pdf",
        title: "Crea comunicazione",
        description: "Lettere a clienti, condòmini o architetti con testo formattato, timbro Dieffe e PDF intestato.",
      },
      {
        icon: "layout",
        title: "Clienti più compatti",
        description: "Un elenco unico e leggero, uguale su computer e telefono, con la scheda cliente a portata di tocco.",
      },
      {
        icon: "desktop",
        title: "Angoli concentrici ovunque",
        description: "Finestre, card e pulsanti seguono la stessa regola di raggi, in stile Apple.",
      },
      {
        icon: "sparkles",
        title: "Pagine uniformi",
        description: "Stessi margini, titoli e spaziature in tutte le sezioni dell'app.",
      },
    ],
  },
  {
    version: "3.15.3",
    date: "2026-10-04",
    headline: "Barra laterale al millimetro.",
    highlights: [
      {
        icon: "layout",
        title: "Tutto allineato",
        description: "Margini uguali a destra e a sinistra, pulsante in alto sulla stessa colonna della freccia.",
      },
      {
        icon: "desktop",
        title: "Raggi annidati",
        description: "Voci, freccia e pulsanti seguono gli angoli della finestra e delle voci che li contengono.",
      },
    ],
  },
  {
    version: "3.15.2",
    date: "2026-10-04",
    headline: "Barra laterale rifinita.",
    highlights: [
      {
        icon: "desktop",
        title: "Barra flottante su Mac",
        description: "Aperta col mouse diventa una card gemella del pannello, con angoli concentrici alla finestra.",
      },
      {
        icon: "layout",
        title: "Semafori centrati",
        description: "Da chiusa la barra è larga quanto i pulsanti della finestra: icone e logo sullo stesso asse.",
      },
      {
        icon: "zap",
        title: "Pulsante sempre raggiungibile",
        description: "Il pulsante per fissare la barra si raggiunge col mouse senza che si richiuda.",
      },
    ],
  },
  {
    version: "3.15.1",
    date: "2026-10-04",
    headline: "Ogni angolo al suo posto.",
    highlights: [
      {
        icon: "layout",
        title: "Raggi annidati ovunque",
        description: "Anche dentro la barra laterale ogni angolo segue quello che lo contiene.",
      },
    ],
  },
  {
    version: "3.15.0",
    date: "2026-10-04",
    headline: "Più fluida, più precisa.",
    highlights: [
      {
        icon: "layout",
        title: "Barra laterale fluida",
        description: "Apertura in sequenza senza salti, pulsanti quadrati e ben distanziati da chiusa.",
      },
      {
        icon: "sparkles",
        title: "Finestre in stile Apple",
        description: "Le finestre si aprono con una transizione morbida; su telefono salgono dal basso.",
      },
      {
        icon: "desktop",
        title: "Angoli perfetti su Mac",
        description: "Il pannello segue la curva degli angoli della finestra, su ogni versione di macOS.",
      },
    ],
  },
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
