// Test dell'agente vocale sul preventivo (D1b/D1c): `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { italianWordNumber, priceWasSpoken, quoteForPrompt, sanitizeAgentOps, spokenNumbers, type AgentQuote } from "./quote-agent";

test("numeri a parole", () => {
  assert.equal(italianWordNumber("quarantacinque"), 45);
  assert.equal(italianWordNumber("ventuno"), 21);
  assert.equal(italianWordNumber("trentotto"), 38);
  assert.equal(italianWordNumber("cento"), 100);
  assert.equal(italianWordNumber("milleduecento"), 1200);
  assert.equal(italianWordNumber("duemilacinquecento"), 2500);
  assert.equal(italianWordNumber("trecentocinquanta"), 350);
  assert.equal(italianWordNumber("metri"), null);
  assert.equal(italianWordNumber("bagno"), null);
});

test("numeri detti in cifre e a parole", () => {
  assert.deepEqual(spokenNumbers("posa a quarantacinque euro al metro"), [45]);
  assert.deepEqual(spokenNumbers("costa 1.200,50 euro"), [1200.5]);
  assert.deepEqual(spokenNumbers("dodici virgola cinque euro"), [12.5]);
  assert.equal(priceWasSpoken(45, "mettici quarantacinque euro"), true);
  assert.equal(priceWasSpoken(1500, "millecinquecento a corpo"), true);
  assert.equal(priceWasSpoken(50, "quarantacinque euro"), false);
});

const quote: AgentQuote = {
  title: "Bagno",
  sections: [
    { ref: "S1", title: "Demolizioni", items: [{ ref: "V1", text: "Demolizione pavimento", quantity: 30, unit: "m²" }] },
    { ref: "S2", title: "Pavimenti", items: [{ ref: "V2", text: "Posa gres 60×60", quantity: 30, unit: "m²", price: null }] },
  ],
};

test("il preventivo arriva all'IA con i codici", () => {
  const s = quoteForPrompt(quote);
  assert.match(s, /\[S1\] Sezione «Demolizioni»/);
  assert.match(s, /\[V2\] Posa gres 60×60 — 30 m² · prezzo da definire/);
});

test("operazioni: codici veri, prezzi detti, sezioni nuove usabili subito", () => {
  const ops = sanitizeAgentOps(
    {
      ops: [
        { op: "update_item", item: "V2", price: 45 },
        { op: "update_item", item: "V9", price: 45 },
        { op: "add_section", ref: "N1", title: "Opere opzionali", optional: true },
        { op: "add_item", section: "N1", text: "Box doccia in cristallo", quantity: 1, unit: "pz", price: 600 },
        { op: "remove_item", item: "V1" },
        { op: "update_section", section: "S7", title: "x" },
        { op: "set_quote", vatRate: 10, discountPercent: 5 },
      ],
    },
    "la posa mettila a quarantacinque euro, aggiungi in opzione il box doccia, togli la demolizione, iva al dieci",
    quote
  );
  assert.equal(ops.length, 5);
  assert.deepEqual(ops[0], { op: "update_item", item: "V2", price: 45 });
  assert.equal(ops[1].op, "add_section");
  // 600 non è stato detto: la voce entra senza prezzo.
  assert.equal(ops[2].op === "add_item" && ops[2].price, null);
  assert.equal(ops[3].op, "remove_item");
  // Lo sconto del 5% non è stato detto: tolto, l'IVA resta.
  assert.deepEqual(ops[4], { op: "set_quote", vatRate: 10 });
});

test("risposte malformate → nessuna operazione", () => {
  assert.deepEqual(sanitizeAgentOps(null, "", quote), []);
  assert.deepEqual(sanitizeAgentOps({ ops: [{ op: "boh" }] }, "", quote), []);
});

test("cliente: si crea o si aggiorna solo con dati validi", () => {
  const noClient: AgentQuote = { title: "x", sections: [] };
  const ops = sanitizeAgentOps(
    { ops: [
      { op: "update_client", phone: "333 1234567" },
      { op: "set_client", name: "Mario Rossi", email: "non-una-email", phone: "333 1234567" },
      { op: "update_client", email: "mario@rossi.it" },
    ] },
    "il cliente è Mario Rossi, telefono 333 1234567, email mario@rossi.it",
    noClient
  );
  // Senza cliente, update_client vale solo dopo un set_client.
  assert.equal(ops.length, 2);
  assert.deepEqual(ops[0], { op: "set_client", name: "Mario Rossi", phone: "333 1234567" });
  assert.deepEqual(ops[1], { op: "update_client", email: "mario@rossi.it" });
});
