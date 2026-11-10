// Test della logica dei cantieri (funzioni pure, niente DB): `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addWorkdays, computeProgress, computeSiteMetrics, isHoliday, isoDay, isWorkday, nextWorkday, toDay } from "./metrics";
import { parsePaymentTerms } from "./payment-terms";
import { FEATURES, sitesEnabledFor } from "../features";

const d = (iso: string) => toDay(iso);

test("festività nazionali, compresa Pasquetta", () => {
  for (const iso of ["2026-01-01", "2026-01-06", "2026-04-25", "2026-05-01", "2026-06-02", "2026-08-15", "2026-11-01", "2026-12-08", "2026-12-25", "2026-12-26"]) {
    assert.ok(isHoliday(d(iso)), iso);
  }
  // Pasqua 2026 = 5 aprile → Pasquetta 6 aprile; Pasqua 2027 = 28 marzo → 29 marzo.
  assert.ok(isHoliday(d("2026-04-06")));
  assert.ok(isHoliday(d("2027-03-29")));
  assert.ok(!isHoliday(d("2026-04-07")));
  assert.ok(!isHoliday(d("2026-11-10")));
});

test("giorni lavorativi: weekend e festività saltati", () => {
  assert.ok(isWorkday(d("2026-11-10"))); // martedì
  assert.ok(!isWorkday(d("2026-11-14"))); // sabato
  assert.ok(!isWorkday(d("2026-12-08"))); // Immacolata (martedì)
  // venerdì 4 dic + 2 lavorativi: lun 7, (mar 8 festa) mer 9.
  assert.equal(isoDay(addWorkdays(d("2026-12-04"), 2)), "2026-12-09");
  // Natale e Santo Stefano: da mer 23 dic + 2 → gio 24, (25, 26, 27 no) lun 28.
  assert.equal(isoDay(addWorkdays(d("2026-12-23"), 2)), "2026-12-28");
  assert.equal(isoDay(nextWorkday(d("2026-11-14"))), "2026-11-16");
  assert.equal(isoDay(nextWorkday(d("2026-11-10"))), "2026-11-10");
});

test("avanzamento pesato sugli importi delle fasi", () => {
  assert.equal(computeProgress([]), 0);
  assert.equal(
    computeProgress([
      { weight: 3000, doneAt: "2026-11-01" },
      { weight: 1000, doneAt: null },
    ]),
    75
  );
  // Senza importi conta il numero delle fasi.
  assert.equal(computeProgress([{ weight: 0, doneAt: "x" }, { weight: 0, doneAt: null }]), 50);
});

test("metriche: SAL, fatturato, ritardo e salute", () => {
  const m = computeSiteMetrics({
    site: { status: "active", startDate: "2026-11-02", plannedEndDate: "2026-11-13", dailyCost: 400, penaltyPerDay: 100, marginPct: 20, progress: 0 },
    quotes: [{ id: "q1", net: 10000, vatRate: 10, status: "accepted" }],
    milestones: [
      { quoteId: "q1", percent: 30, amount: null, reachedAt: "2026-11-02", invoicedAt: "2026-11-03", paidAt: null },
      { quoteId: "q1", percent: 70, amount: null, reachedAt: "2026-11-05", invoicedAt: null, paidAt: null },
    ],
    phases: [{ weight: 10000, plannedStart: "2026-11-02", plannedEnd: "2026-11-13" }],
    today: new Date(2026, 10, 10),
  });
  assert.equal(m.contractNet, 10000);
  assert.equal(Math.round(m.contractGross), 11000);
  assert.equal(m.invoiced, 3000);
  assert.equal(m.toInvoice, 7000);
  assert.equal(m.toCollect, 3000);
  assert.ok(m.delayDays > 0, "fermo a 0% dopo 8 giorni: in ritardo");
  assert.equal(m.dailyBurn, 500);
  assert.equal(m.delayCost, m.delayDays * 500);
  assert.equal(m.margin, 2000);
  assert.equal(m.breakEvenDelayDays, 4);
  assert.equal(m.health, "late");
});

test("metriche: cantiere in attesa e completato", () => {
  const base = { startDate: null, plannedEndDate: null, dailyCost: null, penaltyPerDay: null, marginPct: 20 };
  assert.equal(computeSiteMetrics({ site: { ...base, status: "pending", progress: 0 }, quotes: [], milestones: [] }).health, "pending");
  assert.equal(computeSiteMetrics({ site: { ...base, status: "active", progress: 100 }, quotes: [], milestones: [] }).health, "done");
  assert.equal(computeSiteMetrics({ site: { ...base, status: "active", progress: 10 }, quotes: [], milestones: [] }).health, "not_started");
});

test("condizioni di pagamento lette a regole", () => {
  const ms = parsePaymentTerms("20% alla firma del contratto, 30% a inizio lavori; 30% a fine demolizioni\nsaldo 20% a fine lavori");
  assert.deepEqual(
    ms.map((m) => [m.percent, m.trigger]),
    [
      [20, "accept"],
      [30, "start"],
      [30, "phase"],
      [20, "end"],
    ]
  );
  const fixed = parsePaymentTerms("Acconto € 5.000 all'ordine");
  assert.equal(fixed[0].amount, 5000);
  assert.equal(fixed[0].percent, null);
  assert.equal(fixed[0].trigger, "accept");
  assert.deepEqual(parsePaymentTerms("Pagamento da concordare"), []);
});

test("riattivazione graduale per ruolo e piattaforma", () => {
  const { web, ios } = FEATURES.sites;
  const expect = (level: string, role: string) => level === "all" || (level === "admin" && role === "admin");
  for (const role of ["admin", "editor", "viewer"]) {
    assert.equal(sitesEnabledFor(role, "web"), expect(web, role), `web/${role}`);
    assert.equal(sitesEnabledFor(role, "ios"), expect(ios, role), `ios/${role}`);
  }
  assert.equal(sitesEnabledFor(null), web === "all");
});
