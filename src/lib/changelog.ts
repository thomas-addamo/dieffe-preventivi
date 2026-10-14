// ─────────────────────────────────────────────────────────────────────────────
// Novità di ogni versione (changelog). Ad OGNI rilascio con modifiche visibili
// agli utenti aggiungere in TESTA una voce con la stessa `version` di
// APP_VERSION (src/lib/version.ts).
//
// La schermata "Novità" compare SOLO per le voci con `important: true`, e in
// quel caso ovunque: sito, app Mac/Windows (WhatsNewBanner) e app iPhone
// (WhatsNewView, via /api/app/whats-new). Ritocchi, correzioni e piccole
// aggiunte restano qui senza `important`: nessuno viene disturbato.
// Chi salta una versione importante la vede comunque una volta (getWhatsNew).
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
  | "keyboard"
  | "site";

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
  /** Aggiornamento importante: mostra la schermata "Novità" su tutte le piattaforme. */
  important?: boolean;
  /** Pulsante principale della schermata Novità (es. apri la nuova sezione). */
  cta?: { label: string; href: string };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "4.1.0",
    date: "2026-10-14",
    headline: "Gestione Cantieri anche su iPhone.",
    highlights: [
      {
        icon: "site",
        title: "Cantieri nativi su iPhone",
        description: "Da Altro › Gestione Cantieri: mappa di Apple con indicazioni stradali, fasi da spuntare, SAL con Fatturato e Incassato, calendario con analisi del ritardo, diario e consigli dell'IA.",
      },
      {
        icon: "zap",
        title: "Dalle notifiche al cantiere",
        description: "\"SAL da fatturare\" e i promemoria degli eventi aprono direttamente la scheda giusta del cantiere.",
      },
    ],
  },
  {
    version: "4.0.0",
    date: "2026-10-14",
    headline: "Arriva la Gestione Cantieri.",
    important: true,
    cta: { label: "Apri Gestione Cantieri", href: "/cantieri" },
    highlights: [
      {
        icon: "site",
        title: "I cantieri si creano da soli",
        description: "Ogni preventivo inviato o accettato diventa un cantiere sulla mappa, con indicazioni stradali e le informazioni essenziali a portata di clic.",
      },
      {
        icon: "sparkles",
        title: "Fasi e SAL preparati dall'IA",
        description: "Dalle sezioni e dalle condizioni di pagamento del preventivo: avanzamento pesato sugli importi, SAL da fatturare con le spunte Fatturato e Incassato.",
      },
      {
        icon: "zap",
        title: "Calendario e costo del ritardo",
        description: "Scadenze ed eventi (suolo pubblico, interventi di altre ditte), ritardo stimato e quanto costa ogni giorno in più, con i consigli dell'IA per ogni cantiere.",
      },
    ],
  },
  {
    version: "3.19.1",
    date: "2026-10-14",
    headline: "Database più leggero.",
    highlights: [
      {
        icon: "shield",
        title: "Firme dei clienti su Cloudinary",
        description: "L'immagine della firma non occupa più spazio nel database: resta solo il link, come per le foto delle voci.",
      },
      {
        icon: "zap",
        title: "Pulizia automatica notturna",
        description: "Ogni notte vengono rimosse le sessioni scadute, gli accessi più vecchi di 12 mesi e le notifiche lette da oltre 90 giorni.",
      },
      {
        icon: "settings",
        title: "Rimossa la vecchia tabella dei template",
        description: "Non era più usata dall'app: il database resta più ordinato.",
      },
    ],
  },
  {
    version: "3.19.0",
    date: "2026-10-13",
    headline: "Dieffe nella Dynamic Island.",
    important: true,
    highlights: [
      {
        icon: "layout",
        title: "Preventivo sempre a portata",
        description: "Sull'iPhone, uscendo dall'editor la Dynamic Island mostra codice abbreviato e totale; un tocco e si torna al preventivo.",
      },
      {
        icon: "sparkles",
        title: "Importazione e assistente AI",
        description: "Mentre l'AI analizza un file o risponde si può usare altro: l'isola avvisa quando è pronto.",
      },
      {
        icon: "zap",
        title: "Sopralluogo in cantiere",
        description: "Dal menu del preventivo: cronometro, cliente e indirizzo nell'isola e sulla schermata di blocco, con Aggiungi voce e Termina.",
      },
    ],
  },
  {
    version: "3.18.3",
    date: "2026-10-13",
    headline: "Novità solo quando contano.",
    highlights: [
      {
        icon: "sparkles",
        title: "Novità solo per gli aggiornamenti importanti",
        description: "La schermata Novità compare solo per le versioni importanti, su sito, Mac, Windows e iPhone.",
      },
      {
        icon: "layout",
        title: "Novità anche sull'iPhone",
        description: "Dopo un aggiornamento importante l'app iPhone mostra le novità in una schermata in stile Apple.",
      },
    ],
  },
  {
    version: "3.18.2",
    date: "2026-10-11",
    headline: "Ritocchi all'app per iPhone.",
    highlights: [
      {
        icon: "shield",
        title: "Firma del cliente sull'iPhone",
        description: "Nei preventivi accettati si vedono la firma disegnata dal cliente, data, email e consensi; l'admin può annullare l'accettazione.",
      },
      {
        icon: "layout",
        title: "Barra in alto più ordinata",
        description: "Nella Home dell'app iPhone il ＋ blu per un nuovo preventivo è a parte, e il profilo è un tasto rotondo come gli altri.",
      },
      {
        icon: "sparkles",
        title: "Nuova pagina di accesso",
        description: "Più ordinata e leggera, con la password visibile a richiesta.",
      },
    ],
  },
  {
    version: "3.18.1",
    date: "2026-10-07",
    headline: "Tutto a portata di menu, su Mac e Windows.",
    highlights: [
      {
        icon: "keyboard",
        title: "Nuove scorciatoie",
        description: "⇧⌘N lavoro extra, ⌥⌘N comunicazione, ⌘O importa, ⌘E PDF, ⌘K cerca un preventivo, ⌘1…9 per ogni sezione.",
      },
      {
        icon: "desktop",
        title: "Menu più ricchi",
        description: "Nuovo cliente o voce di listino dal menu File, aspetto chiaro/scuro e barra laterale da Vista, Amministrazione da Vai.",
      },
      {
        icon: "sparkles",
        title: "Strumenti e Aiuto",
        description: "Riordina il listino, chiedi all'assistente o scrivi all'amministratore direttamente dalla barra dei menu.",
      },
    ],
  },
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

/** Confronto semantico "3.18.10" > "3.18.9": negativo, zero o positivo. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * La "Novità" da mostrare a chi usa la versione `current` e ha già visto le
 * novità fino a `seen` (null: mai viste). È l'ultima voce importante non più
 * recente di `current`, se non l'ha ancora vista.
 */
export function getWhatsNew(current: string, seen: string | null): ChangelogEntry | undefined {
  const entry = CHANGELOG.find((e) => e.important && compareVersions(e.version, current) <= 0);
  if (!entry) return undefined;
  if (seen && compareVersions(seen, entry.version) >= 0) return undefined;
  return entry;
}
