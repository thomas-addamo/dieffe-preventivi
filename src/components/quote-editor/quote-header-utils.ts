// Intestazione del preventivo (C3): logica pura, testabile.

const DAY = 86_400_000;

/** Giorni dal `today` alla data "AAAA-MM-GG" (negativi = già passata). */
export function daysUntil(isoDay: string, today = new Date()): number {
  const [y, m, d] = isoDay.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / DAY);
}

/** Testo e colore della validità: scaduto, scade a breve, ancora valido. */
export function validityInfo(validUntil: string | null | undefined, today = new Date()): {
  text: string | null;
  tone?: "warn" | "bad";
  textClass?: string;
} {
  if (!validUntil) return { text: "Il cliente non sa fino a quando vale", tone: "warn", textClass: "text-orange-800 dark:text-orange-300" };
  const n = daysUntil(validUntil, today);
  if (n < 0) return { text: `Scaduto da ${-n} giorn${n === -1 ? "o" : "i"}`, tone: "bad", textClass: "font-medium text-red-700 dark:text-red-400" };
  if (n === 0) return { text: "Scade oggi", tone: "warn", textClass: "font-medium text-orange-800 dark:text-orange-300" };
  if (n <= 7) return { text: `Scade tra ${n} giorn${n === 1 ? "o" : "i"}`, tone: "warn", textClass: "font-medium text-orange-800 dark:text-orange-300" };
  return { text: `Ancora ${n} giorni`, textClass: "text-muted-foreground" };
}

/**
 * Le note citano un'IVA diversa da quella scelta? (es. note "IVA del 10%" con
 * aliquota "Esente"). Restituisce l'avviso da mostrare, o null.
 */
export function notesVatMismatch(notes: string | null | undefined, vatRate: number): string | null {
  if (!notes) return null;
  const found = new Set<number>();
  const re = /\bIVA\b[^\n\d%]{0,25}(\d{1,2})(?:[.,]\d+)?\s*%|(\d{1,2})(?:[.,]\d+)?\s*%[^\n\d]{0,12}\bIVA\b/gi;
  for (const m of notes.matchAll(re)) found.add(Number(m[1] ?? m[2]));
  const other = [...found].filter((v) => v !== vatRate);
  if (!other.length) return null;
  const chosen = vatRate === 0 ? "«Esente»" : `al ${vatRate}%`;
  return `Attenzione: le note parlano di IVA al ${other.join("% e al ")}%, ma l'aliquota scelta è ${chosen}.`;
}
