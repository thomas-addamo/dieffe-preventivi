// ─────────────────────────────────────────────────────────────────────────────
// Interruttori delle funzioni, validi per sito, app desktop e app iPhone (che
// li riceve da /api/app/home). Spegnere una funzione non cancella i suoi dati:
// riaccendendola torna tutto com'era.
//
// Ogni interruttore ha tre livelli, per riaccendere le funzioni a gradi:
//   "off"   → spenta per tutti (menu nascosti, pagine e API in manutenzione)
//   "admin" → solo per gli amministratori (prova sul campo)
//   "all"   → per tutti
// ─────────────────────────────────────────────────────────────────────────────

export type Rollout = "off" | "admin" | "all";

export const FEATURES = {
  /** Gestione Cantieri. `web` vale per sito e app desktop (Mac, Windows),
   *  `ios` per l'app iPhone. */
  sites: { web: "all", ios: "all" } as { web: Rollout; ios: Rollout },
} as const;

export type Platform = "web" | "ios";

function allowed(level: Rollout, role: string | null | undefined) {
  return level === "all" || (level === "admin" && role === "admin");
}

/** Gestione Cantieri visibile e utilizzabile da questo utente? */
export function sitesEnabledFor(role: string | null | undefined, platform: Platform = "web") {
  return allowed(FEATURES.sites[platform], role);
}

/** Accesso alle API /api/sites: basta che la funzione sia accesa su una piattaforma. */
export function sitesApiEnabledFor(role: string | null | undefined) {
  return sitesEnabledFor(role, "web") || sitesEnabledFor(role, "ios");
}

/** Lavori in background (allineamento, IA, notifiche): attivi se la funzione è accesa per qualcuno. */
export const SITES_BACKGROUND = FEATURES.sites.web !== "off" || FEATURES.sites.ios !== "off";

export const SITES_MAINTENANCE_MESSAGE =
  "Gestione Cantieri è momentaneamente disabilitata per manutenzione: tornerà disponibile a breve su tutti i dispositivi.";
