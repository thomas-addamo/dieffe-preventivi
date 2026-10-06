import "server-only";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  auditLog,
  companySettings,
  priceListItems,
  quoteItems,
  quoteSections,
  quotes,
  type PriceListItem,
} from "@/lib/db/schema";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";
import { toPlainText } from "@/lib/rich-text";
import { generateId } from "@/lib/utils";
import {
  CATALOG,
  canonicalCategory,
  categoryPrefix,
  isCatalogCategory,
  sortCatalog,
} from "./taxonomy";
import { MAYBE_SAME, SAME_ITEM, SimilarityIndex, fingerprint, similarity, sameUnit } from "./similarity";

// ─────────────────────────────────────────────────────────────────────────────
// Riordino automatico del listino (cron giornaliero + pulsante "Riordina ora").
//
//  1. Uso reale   — confronta le voci del listino con le voci dei preventivi
//                   degli ultimi N mesi: aggiorna "ultimo utilizzo" e numero
//                   di preventivi in cui compare.
//  2. Pulizia     — elimina le voci non usate da più di N mesi (non fissate).
//  3. Doppioni    — raggruppa le voci simili; l'AI decide se unirle (tenendo
//                   la migliore) o mantenerle distinte. Senza AI si uniscono
//                   solo i doppioni certi.
//  4. Catalogo    — assegna categoria (catalogo fisso) e sottocategoria.
//  5. Codici      — rinumera in modo gerarchico: PAV.02.05.
// ─────────────────────────────────────────────────────────────────────────────

export interface MaintenanceReport {
  at: string;
  trigger: "auto" | "manual";
  aiUsed: boolean;
  total: number;
  usageUpdated: number;
  deleted: number;
  deletedExamples: string[];
  merged: number;
  mergedExamples: { kept: string; removed: string[] }[];
  categorized: number;
  renumbered: number;
  /** Lavoro rimandato al giro successivo per limiti di tempo. */
  partial: boolean;
}

type Item = PriceListItem;

function subMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() - months);
  return x;
}

/** UPDATE massivo in una sola richiesta: UPDATE … FROM (VALUES …). */
async function bulkUpdate(
  rows: { id: string; set: Record<string, string | number | boolean | null> }[],
  columns: { key: string; column: string; cast: string }[]
) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const values = sql.join(
      chunk.map(
        (r) =>
          sql`(${r.id}::uuid, ${sql.join(
            columns.map((c) => sql`${r.set[c.key] ?? null}::${sql.raw(c.cast)}`),
            sql`, `
          )})`
      ),
      sql`, `
    );
    const assignments = sql.join(
      columns.map((c) => sql`${sql.identifier(c.column)} = v.${sql.identifier(c.column)}`),
      sql`, `
    );
    const names = sql.join(
      columns.map((c) => sql.identifier(c.column)),
      sql`, `
    );
    await db.execute(sql`
      update price_list_items as p set ${assignments}
      from (values ${values}) as v(id, ${names})
      where p.id = v.id`);
  }
}

// ─── 1. Uso reale ─────────────────────────────────────────────────────────────

async function refreshUsage(items: Item[], since: Date): Promise<number> {
  const rows = await db
    .select({
      description: quoteItems.description,
      unit: quoteItems.unitOfMeasure,
      quoteId: quotes.id,
      updatedAt: quotes.updatedAt,
    })
    .from(quoteItems)
    .innerJoin(quoteSections, eq(quoteItems.sectionId, quoteSections.id))
    .innerJoin(quotes, eq(quoteSections.quoteId, quotes.id))
    .where(and(isNull(quotes.deletedAt), gte(quotes.updatedAt, since.toISOString())));

  const index = new SimilarityIndex<Item>();
  for (const it of items) index.add(it, it.description, it.unitOfMeasure);

  const usage = new Map<string, { quotes: Set<string>; last: number }>();
  for (const r of rows) {
    const text = toPlainText(r.description);
    if (text.trim().length < 3) continue;
    const best = index.find(text, r.unit, 0.7)[0];
    if (!best) continue;
    const u = usage.get(best.item.id) ?? { quotes: new Set<string>(), last: 0 };
    u.quotes.add(r.quoteId);
    u.last = Math.max(u.last, new Date(r.updatedAt).getTime());
    usage.set(best.item.id, u);
  }

  const updates: { id: string; set: Record<string, string | number | null> }[] = [];
  for (const it of items) {
    const u = usage.get(it.id);
    const stored = it.lastUsedAt ? new Date(it.lastUsedAt).getTime() : 0;
    const last = Math.max(stored, u?.last ?? 0);
    const count = u?.quotes.size ?? 0;
    if (last !== stored || count !== it.usageCount) {
      updates.push({ id: it.id, set: { last_used_at: last ? new Date(last).toISOString() : null, usage_count: count } });
      it.lastUsedAt = last ? new Date(last) : null;
      it.usageCount = count;
    }
  }
  await bulkUpdate(updates, [
    { key: "last_used_at", column: "last_used_at", cast: "timestamptz" },
    { key: "usage_count", column: "usage_count", cast: "integer" },
  ]);
  return updates.length;
}

// ─── 3. Doppioni ──────────────────────────────────────────────────────────────

/** Voce da tenere in un gruppo: fissata > inserita a mano > più usata > più recente. */
function rank(it: Item): number[] {
  return [
    it.pinned ? 1 : 0,
    it.source === "manual" ? 1 : 0,
    it.usageCount,
    it.lastUsedAt ? new Date(it.lastUsedAt).getTime() : 0,
    it.createdAt ? new Date(it.createdAt).getTime() : 0,
  ];
}
function better(a: Item, b: Item) {
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] > rb[i];
  return false;
}

function clusters(items: Item[]): { items: Item[]; certain: boolean }[] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  const index = new SimilarityIndex<number>();
  items.forEach((it, i) => index.add(i, it.description, it.unitOfMeasure));
  items.forEach((it, i) => {
    for (const { item: j } of index.find(it.description, it.unitOfMeasure, MAYBE_SAME)) {
      if (j !== i) parent[find(j)] = find(i);
    }
  });

  const groups = new Map<number, Item[]>();
  items.forEach((it, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), it]);
  });
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.slice(0, 8))
    .map((g) => ({ items: g, certain: minPairScore(g) >= 0.95 }));
}

function minPairScore(g: Item[]): number {
  const fps = g.map((i) => fingerprint(i.description));
  let min = 1;
  for (let i = 0; i < fps.length; i++)
    for (let j = i + 1; j < fps.length; j++) min = Math.min(min, similarity(fps[i], fps[j]));
  return min;
}

interface AiMerge {
  groups: { group: number; merges: { keep: number; remove: number[]; description?: string }[] }[];
}

async function dedupe(
  items: Item[],
  onlySince: Date | null,
  useAi: boolean,
  deadline: number,
  report: MaintenanceReport
): Promise<Set<string>> {
  const removed = new Set<string>();
  let groups = clusters(items);
  // Giro automatico: solo gruppi con almeno una voce nuova o modificata.
  if (onlySince) {
    const t = onlySince.getTime();
    groups = groups.filter((g) =>
      g.items.some((i) => new Date(i.updatedAt ?? i.createdAt ?? 0).getTime() > t)
    );
  }

  const merges: { keep: Item; remove: Item[]; description?: string }[] = [];
  const ambiguous: typeof groups = [];
  for (const g of groups) {
    if (g.certain || !useAi) {
      // Senza AI si uniscono solo i doppioni certi (somiglianza ≥ SAME_ITEM tra tutti).
      const certain = g.certain || minPairScore(g.items) >= SAME_ITEM;
      if (!certain) continue;
      const keep = g.items.reduce((a, b) => (better(b, a) ? b : a));
      merges.push({ keep, remove: g.items.filter((i) => i !== keep) });
    } else {
      ambiguous.push(g);
    }
  }

  const system = `Sei il responsabile del listino prezzi di un'impresa edile. Ricevi gruppi di voci simili.
Per ogni gruppo decidi quali voci sono LA STESSA lavorazione (da unire) e quali sono DIVERSE (da tenere entrambe).
Sono diverse se cambia materiale, formato/misura, spessore, tipo (fornitura vs posa) o lavorazione.
Per ogni unione indica la voce da tenere ("keep": la più chiara/completa) e quelle da eliminare ("remove");
facoltativo "description": descrizione unificata breve (max 10 parole) se migliora la voce tenuta.
Rispondi SOLO con JSON: {"groups":[{"group":1,"merges":[{"keep":2,"remove":[1,3],"description":"..."}]}]}.
Un gruppo senza unioni ha "merges": [].`;

  for (let i = 0; i < ambiguous.length; i += 12) {
    if (Date.now() > deadline) {
      report.partial = true;
      break;
    }
    const batch = ambiguous.slice(i, i + 12);
    const prompt = batch
      .map(
        (g, gi) =>
          `Gruppo ${gi + 1}:\n` +
          g.items
            .map(
              (it, k) =>
                `  ${k + 1}. "${it.description}" — ${it.unitOfMeasure}, €${it.unitPrice}` +
                `${it.pinned ? " [FISSATA]" : ""}, usata in ${it.usageCount} preventivi`
            )
            .join("\n")
      )
      .join("\n\n");
    try {
      const ai = await generateAIJson<AiMerge>(system, prompt, 20000, 2500);
      for (const g of ai.groups ?? []) {
        const group = batch[g.group - 1];
        if (!group) continue;
        const used = new Set<number>();
        for (const m of g.merges ?? []) {
          const keep = group.items[m.keep - 1];
          if (!keep || used.has(m.keep)) continue;
          const remove = (m.remove ?? [])
            .filter((n) => n !== m.keep && !used.has(n))
            .map((n) => group.items[n - 1])
            .filter((x): x is Item => !!x && !x.pinned && sameUnit(x.unitOfMeasure, keep.unitOfMeasure));
          if (remove.length === 0) continue;
          used.add(m.keep);
          remove.forEach((r) => used.add(group.items.indexOf(r) + 1));
          merges.push({ keep, remove, description: m.description?.trim() || undefined });
        }
      }
    } catch {
      report.partial = true;
    }
  }

  // Applica le unioni.
  const keepUpdates: { id: string; set: Record<string, string | number | null> }[] = [];
  for (const m of merges) {
    const remove = m.remove.filter((r) => !r.pinned && !removed.has(r.id) && r.id !== m.keep.id);
    if (remove.length === 0 || removed.has(m.keep.id)) continue;
    remove.forEach((r) => removed.add(r.id));
    const all = [m.keep, ...remove];
    const last = Math.max(...all.map((i) => (i.lastUsedAt ? new Date(i.lastUsedAt).getTime() : 0)));
    const description =
      m.description && !m.keep.pinned && m.keep.source !== "manual"
        ? m.description.slice(0, 200)
        : m.keep.description;
    keepUpdates.push({
      id: m.keep.id,
      set: {
        description,
        usage_count: all.reduce((n, i) => n + i.usageCount, 0),
        last_used_at: last ? new Date(last).toISOString() : null,
      },
    });
    m.keep.description = description;
    report.merged += remove.length;
    if (report.mergedExamples.length < 20) {
      report.mergedExamples.push({ kept: description, removed: remove.map((r) => r.description) });
    }
  }
  await bulkUpdate(keepUpdates, [
    { key: "description", column: "description", cast: "text" },
    { key: "usage_count", column: "usage_count", cast: "integer" },
    { key: "last_used_at", column: "last_used_at", cast: "timestamptz" },
  ]);
  if (removed.size) {
    await db.execute(sql`delete from price_list_items where id in (${sql.join(
      [...removed].map((id) => sql`${id}::uuid`),
      sql`, `
    )})`);
  }
  return removed;
}

// ─── 4. Catalogo ──────────────────────────────────────────────────────────────

interface AiCatalog {
  items: { i: number; category: string; subcategory?: string }[];
}

export async function classify(
  list: { description: string; unit: string; category?: string | null }[],
  existingSubcategories: Record<string, string[]>,
  useAi: boolean,
  timeoutMs = 20000
): Promise<{ category: string; subcategory: string | null }[]> {
  const fallback = list.map((x) => ({
    category: canonicalCategory(x.category, x.description),
    subcategory: null as string | null,
  }));
  if (!useAi || list.length === 0) return fallback;

  const cats = CATALOG.map((c) => {
    const subs = existingSubcategories[c.name] ?? [];
    return `- ${c.name}${subs.length ? ` (sottocategorie esistenti: ${subs.slice(0, 12).join(", ")})` : ""}`;
  }).join("\n");
  const system = `Sei un computista edile. Cataloga ogni voce di listino in UNA categoria dell'elenco (scrivi il nome esatto) e in una sottocategoria breve (1-3 parole, es. "Gres porcellanato", "Cartongesso", "Sanitari sospesi").
Riusa le sottocategorie esistenti quando adatte, così il catalogo resta ordinato.
Categorie:
${cats}
Rispondi SOLO con JSON: {"items":[{"i":1,"category":"...","subcategory":"..."}]} per tutte le voci.`;
  const prompt = list
    .map((x, i) => `${i + 1}. "${x.description}" (${x.unit})${x.category ? ` [categoria attuale: ${x.category}]` : ""}`)
    .join("\n");
  try {
    const ai = await generateAIJson<AiCatalog>(system, prompt, timeoutMs, 60 * list.length + 300);
    const out = [...fallback];
    for (const r of ai.items ?? []) {
      const k = r.i - 1;
      if (!out[k]) continue;
      out[k] = {
        category: isCatalogCategory(r.category) ? r.category : canonicalCategory(r.category, list[k].description),
        subcategory: r.subcategory?.trim().slice(0, 40) || null,
      };
    }
    return out;
  } catch {
    return fallback;
  }
}

function subcategoriesByCategory(items: Item[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const it of items) {
    if (!it.category || !it.subcategory) continue;
    (map[it.category] ??= new Set()).add(it.subcategory);
  }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]));
}

async function catalog(items: Item[], useAi: boolean, deadline: number, report: MaintenanceReport) {
  const todo = items.filter((i) => !isCatalogCategory(i.category) || !i.subcategory);
  const updates: { id: string; set: Record<string, string | null> }[] = [];
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const ai = useAi && Date.now() < deadline;
    if (useAi && !ai) report.partial = true;
    const result = await classify(
      batch.map((b) => ({ description: b.description, unit: b.unitOfMeasure, category: b.category })),
      subcategoriesByCategory(items),
      ai
    );
    batch.forEach((b, k) => {
      const r = result[k];
      const subcategory = r.subcategory ?? b.subcategory ?? null;
      if (r.category !== b.category || subcategory !== b.subcategory) {
        b.category = r.category;
        b.subcategory = subcategory;
        updates.push({ id: b.id, set: { category: r.category, subcategory } });
      }
    });
  }
  await bulkUpdate(updates, [
    { key: "category", column: "category", cast: "text" },
    { key: "subcategory", column: "subcategory", cast: "text" },
  ]);
  report.categorized = updates.length;
}

// ─── 5. Codici gerarchici ─────────────────────────────────────────────────────

export { sortCatalog };

/** Rinumera tutte le voci: PREFISSO.SS.NN (SS = 00 se senza sottocategoria). */
export async function renumberCodes(items?: Item[]): Promise<number> {
  const all = items ?? (await db.select().from(priceListItems));
  const sorted = sortCatalog(all);
  const subIndex = new Map<string, Map<string, number>>();
  const counters = new Map<string, number>();
  const updates: { id: string; set: Record<string, string> }[] = [];
  for (const it of sorted) {
    const cat = it.category ?? "";
    const subs = subIndex.get(cat) ?? new Map<string, number>();
    subIndex.set(cat, subs);
    let ss = 0;
    if (it.subcategory) {
      if (!subs.has(it.subcategory)) subs.set(it.subcategory, subs.size + 1);
      ss = subs.get(it.subcategory)!;
    }
    const key = `${cat}|${ss}`;
    const nn = (counters.get(key) ?? 0) + 1;
    counters.set(key, nn);
    const code = `${categoryPrefix(it.category)}.${String(ss).padStart(2, "0")}.${String(nn).padStart(2, "0")}`;
    if (code !== it.code) {
      updates.push({ id: it.id, set: { code } });
      it.code = code;
    }
  }
  await bulkUpdate(updates, [{ key: "code", column: "code", cast: "text" }]);
  return updates.length;
}

// ─── Orchestrazione ──────────────────────────────────────────────────────────

export async function runPriceListMaintenance({
  trigger,
  userId = null,
  budgetMs = 45_000,
}: {
  trigger: "auto" | "manual";
  userId?: string | null;
  budgetMs?: number;
}): Promise<MaintenanceReport> {
  const started = Date.now();
  const deadline = started + budgetMs;
  const [settings] = await db.select().from(companySettings).limit(1);
  const retention = Math.max(1, settings?.priceListRetentionMonths ?? 12);
  const lastRun = settings?.priceListMaintainedAt ? new Date(settings.priceListMaintainedAt) : null;
  const useAi = isAiConfigured() && (settings?.aiEnabled ?? true);
  const now = new Date();
  const cutoff = subMonths(now, retention);

  const report: MaintenanceReport = {
    at: now.toISOString(),
    trigger,
    aiUsed: useAi,
    total: 0,
    usageUpdated: 0,
    deleted: 0,
    deletedExamples: [],
    merged: 0,
    mergedExamples: [],
    categorized: 0,
    renumbered: 0,
    partial: false,
  };

  let items = await db.select().from(priceListItems);

  // 1. Uso reale nei preventivi del periodo di conservazione.
  report.usageUpdated = await refreshUsage(items, cutoff);

  // 2. Pulizia: mai usate (o non più usate) da oltre N mesi, non fissate.
  const stale = items.filter((i) => {
    if (i.pinned) return false;
    const ref = i.lastUsedAt ?? i.createdAt;
    return !ref || new Date(ref) < cutoff;
  });
  if (stale.length) {
    await db.execute(sql`delete from price_list_items where id in (${sql.join(
      stale.map((s) => sql`${s.id}::uuid`),
      sql`, `
    )})`);
    report.deleted = stale.length;
    report.deletedExamples = stale.slice(0, 20).map((s) => s.description);
    const gone = new Set(stale.map((s) => s.id));
    items = items.filter((i) => !gone.has(i.id));
  }

  // 3. Doppioni (giro automatico: solo voci nuove dall'ultimo riordino).
  const removed = await dedupe(
    items,
    trigger === "auto" ? lastRun : null,
    useAi,
    deadline - 15_000,
    report
  );
  items = items.filter((i) => !removed.has(i.id));

  // 4. Catalogo e 5. codici.
  await catalog(items, useAi, deadline - 8_000, report);
  report.renumbered = await renumberCodes(items);
  report.total = items.length;

  await db
    .update(companySettings)
    .set({ priceListMaintainedAt: now.toISOString(), priceListMaintenanceReport: report })
    .where(eq(companySettings.id, settings?.id ?? 1));

  if (report.deleted || report.merged || report.categorized) {
    await db.insert(auditLog).values({
      id: generateId(),
      userId,
      action: "price_list.maintenance",
      entityType: "price_list",
      entityId: null,
      changes: {
        trigger,
        deleted: report.deleted,
        merged: report.merged,
        categorized: report.categorized,
      } as Record<string, unknown>,
    });
  }

  return report;
}
