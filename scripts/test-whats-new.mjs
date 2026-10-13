// Controlli della logica "Novità" (src/lib/changelog.ts, getWhatsNew):
//   node --experimental-strip-types scripts/test-whats-new.mjs
import assert from "node:assert/strict";
const m = await import("../src/lib/changelog.ts");
const { compareVersions, getWhatsNew, CHANGELOG } = m;
let n = 0; const ok = (c, l) => { assert.ok(c, l); n++; console.log("OK  ", l); };
ok(compareVersions("3.18.10", "3.18.9") > 0, "3.18.10 > 3.18.9");
ok(compareVersions("3.19.0", "3.18.12") > 0, "3.19.0 > 3.18.12");
ok(compareVersions("3.18.2", "3.18.2") === 0, "uguali");
ok(compareVersions("4.0", "3.99.99") > 0, "major");
// Changelog di prova: 3.20.1 ritocco, 3.20.0 importante, 3.19.0 importante.
const saved = CHANGELOG.splice(0, CHANGELOG.length,
  { version: "3.20.1", date: "x", headline: "r", highlights: [] },
  { version: "3.20.0", date: "x", headline: "big", highlights: [], important: true },
  { version: "3.19.1", date: "x", headline: "r", highlights: [] },
  { version: "3.19.0", date: "x", headline: "old", highlights: [], important: true });
ok(getWhatsNew("3.20.0", null)?.version === "3.20.0", "versione importante: si mostra");
ok(getWhatsNew("3.20.1", "3.19.1")?.version === "3.20.0", "saltata l'importante (aggiorna a un ritocco): si mostra lo stesso");
ok(getWhatsNew("3.20.1", "3.20.0") === undefined, "già vista: niente");
ok(getWhatsNew("3.20.1", "3.20.1") === undefined, "chiusa sul ritocco: niente");
ok(getWhatsNew("3.19.1", "3.19.0") === undefined, "solo ritocchi dopo l'ultima vista: niente");
ok(getWhatsNew("3.19.5", null)?.version === "3.19.0", "non mostra versioni future rispetto all'app");
ok(getWhatsNew("3.18.0", null) === undefined, "nessuna importante fino a quella versione");
CHANGELOG.splice(0, CHANGELOG.length, ...saved);
ok(CHANGELOG.every((e) => !e.important) ? getWhatsNew("3.18.3", null) === undefined : true, "changelog vero: nessuna schermata per i ritocchi attuali");
console.log(`RISULTATO: ${n} controlli OK`);
