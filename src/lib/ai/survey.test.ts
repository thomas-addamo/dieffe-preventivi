// Test del sopralluogo con IA (D1b): `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { draftForPrompt, normalizeUnit, priceWasSpoken, sanitizeSurveyOps, spokenNumbers } from "./survey";

test("numeri detti nel parlato", () => {
  assert.deepEqual(spokenNumbers("trenta metri, 30 m², a 45 euro"), [30, 45]);
  assert.deepEqual(spokenNumbers("costa 1.200,50 euro"), [1200.5]);
  assert.deepEqual(spokenNumbers("prezzo 12,5"), [12.5]);
});

test("il prezzo passa solo se è stato detto", () => {
  assert.equal(priceWasSpoken(45, "posa a 45 euro al metro"), true);
  assert.equal(priceWasSpoken(50, "posa a 45 euro al metro"), false);
  assert.equal(priceWasSpoken(1200, "costa 1.200 euro"), true);
});

test("operazioni valide, prezzi inventati tolti", () => {
  const ops = sanitizeSurveyOps(
    {
      ops: [
        { op: "add_item", section: "Pavimenti", text: "Posa gres 60×60", quantity: 30, unit: "mq", price: 45 },
        { op: "add_item", section: "Demolizioni", text: "Demolizione pavimento", quantity: 30, unit: "m2", price: 18 },
        { op: "add_note", text: "Umidità sulla parete nord" },
        { op: "boh", text: "x" },
        { op: "add_item", section: "", text: "senza sezione" },
      ],
    },
    "posa gres 60 per 60 trenta metri quadri a 45 euro al metro; demolire il pavimento"
  );
  assert.equal(ops.length, 3);
  assert.deepEqual(ops[0], { op: "add_item", section: "Pavimenti", text: "Posa gres 60×60", quantity: 30, unit: "m²", price: 45 });
  // 18 € non è stato detto: il prezzo sparisce, la voce resta.
  assert.equal(ops[1].op === "add_item" && ops[1].price, null);
  assert.equal(ops[2].op, "add_note");
});

test("risposte malformate → nessuna operazione", () => {
  assert.deepEqual(sanitizeSurveyOps(null, ""), []);
  assert.deepEqual(sanitizeSurveyOps("testo", ""), []);
  assert.deepEqual(sanitizeSurveyOps({ ops: "no" }, ""), []);
});

test("unità come nei preventivi", () => {
  assert.equal(normalizeUnit("MQ"), "m²");
  assert.equal(normalizeUnit("metri lineari"), "m");
  assert.equal(normalizeUnit("corpo"), "a corpo");
  assert.equal(normalizeUnit("pezzi"), "pz");
});

test("bozza compatta per l'IA", () => {
  assert.equal(draftForPrompt({ sections: [], notes: [] }), "(bozza vuota)");
  const s = draftForPrompt({
    title: "Bagno",
    sections: [{ title: "Pavimenti", items: [{ text: "Posa gres", quantity: 30, unit: "m²", price: 45 }] }],
    notes: ["Umidità"],
  });
  assert.match(s, /Titolo: Bagno/);
  assert.match(s, /Posa gres — 30 m² — 45 €/);
  assert.match(s, /Note:\n {2}• Umidità/);
});
