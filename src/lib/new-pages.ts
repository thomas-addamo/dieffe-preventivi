// ─────────────────────────────────────────────────────────────────────────────
// Pagine nuove: accanto alla voce di menu compare "Novità" per NEW_BADGE_DAYS
// giorni dalla data di lancio, poi sparisce da sola.
//
// Quando si crea una pagina per gli utenti, aggiungerla qui con la data di
// pubblicazione (YYYY-MM-DD). Le voci scadute si possono lasciare: non fanno nulla.
// ─────────────────────────────────────────────────────────────────────────────

export const NEW_BADGE_DAYS = 30;

const NEW_PAGES: Record<string, string> = {
  "/comunicazioni": "2026-10-06",
};

/** True se la pagina è stata lanciata da meno di NEW_BADGE_DAYS giorni. */
export function isNewPage(href: string, now: Date = new Date()): boolean {
  const launched = NEW_PAGES[href];
  if (!launched) return false;
  const start = new Date(`${launched}T00:00:00`).getTime();
  return now.getTime() - start < NEW_BADGE_DAYS * 86_400_000;
}

/** True se almeno una delle pagine indicate è nuova. */
export function hasNewPage(hrefs: string[], now: Date = new Date()): boolean {
  return hrefs.some((h) => isNewPage(h, now));
}

/** Etichetta "Novità" condivisa (sidebar, Altro). */
export const NEW_BADGE_CLASS =
  "shrink-0 rounded-full bg-primary/10 px-1 py-px text-[10px] font-semibold leading-tight text-primary";
