// ─────────────────────────────────────────────────────────────────────────────
// Interruttori delle funzioni, validi per sito, app desktop e app iPhone (che
// li riceve da /api/app/home). Spegnere una funzione non cancella i suoi dati:
// riaccendendola torna tutto com'era.
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURES = {
  /** Gestione Cantieri: sospesa per manutenzione finché non è pronta anche
   *  la versione iPhone. Spenta = menu nascosti, pagine e API in manutenzione,
   *  nessun lavoro in background (sincronizzazione, IA, notifiche SAL). */
  sites: false,
} as const;

export const SITES_MAINTENANCE_MESSAGE =
  "Gestione Cantieri è momentaneamente disabilitata per manutenzione: tornerà disponibile a breve su tutti i dispositivi.";
