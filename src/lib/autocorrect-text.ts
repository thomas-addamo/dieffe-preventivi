// ─────────────────────────────────────────────────────────────────────────────
// Correzione automatica (B2): la parte locale, senza IA. Pura e testabile.
// Sistema ciò che si corregge con certezza (maiuscola iniziale, spazi doppi,
// spazi prima della punteggiatura e mancanti dopo); il resto (refusi,
// accenti, grammatica) lo fa l'IA, e solo se il testo è abbastanza lungo.
// Non tocca mai cifre, a capo e marcatori di formato.
// ─────────────────────────────────────────────────────────────────────────────

/** Correzioni sicure fatte in locale, riga per riga. */
export function localFix(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const m = /^(\s*(?:[-•]\s+|\d{1,3}\.\s+)?)([\s\S]*)$/.exec(line)!;
      const prefix = m[1];
      let body = m[2];
      body = body
        // spazi doppi interni
        .replace(/(\S) {2,}(?=\S)/g, "$1 ")
        // niente spazio prima di , ; : . ! ?
        .replace(/(\S) +([,;:!?]|\.(?!\.))(?=\s|$)/g, "$1$2")
        // spazio dopo , ; se manca (non tra cifre: 1,5 e 10;20 restano)
        // (gli spazi finali restano: l'utente potrebbe star per continuare)
        .replace(/([,;])(?=[A-Za-zÀ-ÿ])/g, "$1 ");
      // maiuscola iniziale (dopo eventuali marcatori come ** o *)
      body = body.replace(/^([*_~]*)([a-zà-ÿ])/, (_, mk: string, c: string) => mk + c.toUpperCase());
      return prefix + body;
    })
    .join("\n");
}

/** Abbastanza testo da valere una chiamata all'IA (almeno 3 parole). */
export function worthAi(text: string): boolean {
  return text.trim().split(/\s+/).filter((w) => /[a-zà-ÿ]{2,}/i.test(w)).length >= 3;
}

/** Posizione del cursore dopo la correzione: resta nello stesso punto del testo. */
export function mapCaret(before: string, after: string, caret: number): number {
  if (caret >= before.length) return after.length;
  let p = 0;
  while (p < before.length && p < after.length && before[p] === after[p]) p++;
  if (caret <= p) return caret;
  return Math.max(0, Math.min(after.length, caret + (after.length - before.length)));
}
