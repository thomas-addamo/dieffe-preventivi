// Test dell'intestazione del preventivo (C3): `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntil, notesVatMismatch, validityInfo } from "./quote-header-utils";

const today = new Date(2026, 10, 21); // 21 novembre 2026

test("giorni alla scadenza", () => {
  assert.equal(daysUntil("2026-11-21", today), 0);
  assert.equal(daysUntil("2026-12-21", today), 30);
  assert.equal(daysUntil("2026-10-30", today), -22);
});

test("validità: testo e colore", () => {
  assert.equal(validityInfo(null, today).tone, "warn");
  assert.equal(validityInfo("2026-10-30", today).text, "Scaduto da 22 giorni");
  assert.equal(validityInfo("2026-10-30", today).tone, "bad");
  assert.equal(validityInfo("2026-11-22", today).text, "Scade tra 1 giorno");
  assert.equal(validityInfo("2026-11-21", today).text, "Scade oggi");
  assert.equal(validityInfo("2027-01-20", today).tone, undefined);
});

test("note con un'IVA diversa da quella scelta", () => {
  const notes = "Possibilità di detrazione del 50% applicabile in 10 anni\nDal Totale è esclusa l'IVA del 10%";
  assert.match(notesVatMismatch(notes, 0)!, /IVA al 10%.*«Esente»/);
  assert.equal(notesVatMismatch(notes, 10), null);
  // La detrazione del 50% non è un'aliquota IVA.
  assert.equal(notesVatMismatch("Detrazione del 50%", 0), null);
  assert.match(notesVatMismatch("Prezzi IVA 22% esclusa", 10)!, /IVA al 22%/);
  assert.match(notesVatMismatch("Aliquota 4% IVA agevolata", 22)!, /IVA al 4%/);
  assert.equal(notesVatMismatch("", 22), null);
});
