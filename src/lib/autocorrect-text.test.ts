// Test della correzione automatica locale (B2): `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { localFix, mapCaret, worthAi } from "./autocorrect-text";

test("maiuscola iniziale, anche dopo marcatori ed elenchi", () => {
  assert.equal(localFix("rifacimento bagno"), "Rifacimento bagno");
  assert.equal(localFix("**demolizione** pareti"), "**Demolizione** pareti");
  assert.equal(localFix("- posa piastrelle\n- stuccatura"), "- Posa piastrelle\n- Stuccatura");
  assert.equal(localFix("1. scavo"), "1. Scavo");
});

test("spazi e punteggiatura", () => {
  assert.equal(localFix("Posa  in opera , compreso trasporto ."), "Posa in opera, compreso trasporto.");
  assert.equal(localFix("Malta,sabbia;cemento"), "Malta, sabbia; cemento");
  assert.equal(localFix("Fine lavori..."), "Fine lavori...");
});

test("cifre, misure e a capo restano intatti", () => {
  assert.equal(localFix("Spessore 1,5 cm per 10;20 mq"), "Spessore 1,5 cm per 10;20 mq");
  assert.equal(localFix("Riga uno\n\nriga tre"), "Riga uno\n\nRiga tre");
  assert.equal(localFix("€ 1.250,00"), "€ 1.250,00");
});

test("testo già corretto: identico", () => {
  const t = "Ristrutturazione completa dell'appartamento.";
  assert.equal(localFix(t), t);
});

test("IA solo con almeno tre parole", () => {
  assert.ok(!worthAi("Bagno"));
  assert.ok(!worthAi("Via Roma 12"));
  assert.ok(worthAi("rifacimento completo del bagno"));
});

test("il cursore resta al suo posto", () => {
  assert.equal(mapCaret("ciao mondo", "Ciao mondo", 4), 4);
  assert.equal(mapCaret("a  b", "a b", 4), 3);
  assert.equal(mapCaret("abc", "Abcd", 3), 4);
});
