import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, quoteItems, quoteSections, quotes } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { updateQuoteField, upsertItem, upsertSection } from "@/lib/db/quotes";
import type { AgentOp, AgentQuote } from "./quote-agent";

// ─────────────────────────────────────────────────────────────────────────────
// Comando vocale sul preventivo (D1c): applica le operazioni dell'agente al
// preventivo vero e prepara l'"Annulla" (lo stato precedente di ciò che cambia,
// salvato nel registro attività). Le foto di una voce tolta non tornano con
// l'annulla: la voce sì.
// ─────────────────────────────────────────────────────────────────────────────

type SectionRow = typeof quoteSections.$inferSelect;
type ItemRow = typeof quoteItems.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type QuoteFields = Pick<typeof quotes.$inferSelect, "clientId" | "title" | "vatRate" | "discountType" | "discountValue" | "validUntil" | "paymentTerms" | "projectAddress" | "notes">;

export type AgentUndo = {
  quote?: QuoteFields;
  createdSections: string[];
  createdItems: string[];
  createdClients?: string[];
  clients?: ClientRow[];
  sections: SectionRow[];
  items: ItemRow[];
};

export type LoadedQuote = {
  agent: AgentQuote;
  sectionByRef: Map<string, SectionRow>;
  itemByRef: Map<string, ItemRow>;
  sections: SectionRow[];
  items: ItemRow[];
  quote: typeof quotes.$inferSelect;
  client: ClientRow | null;
};

/** Il preventivo con i codici S1…/V1… per l'agente. */
export async function loadQuoteForAgent(quoteId: string): Promise<LoadedQuote | null> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote || quote.deletedAt) return null;
  const [client] = quote.clientId ? await db.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1) : [];
  const sections = await db.select().from(quoteSections).where(eq(quoteSections.quoteId, quoteId)).orderBy(asc(quoteSections.orderIndex));
  const items = sections.length
    ? await db.select().from(quoteItems).where(inArray(quoteItems.sectionId, sections.map((s) => s.id))).orderBy(asc(quoteItems.orderIndex))
    : [];
  const sectionByRef = new Map<string, SectionRow>();
  const itemByRef = new Map<string, ItemRow>();
  let v = 0;
  const agent: AgentQuote = {
    title: quote.title,
    client: client?.name ?? null,
    clientInfo: client ? { address: client.address, vatNumber: client.vatNumber, email: client.email, phone: client.phone } : null,
    address: quote.projectAddress,
    vatRate: quote.vatRate,
    discountPercent: quote.discountType === "percent" ? quote.discountValue : null,
    validUntil: quote.validUntil,
    paymentTerms: quote.paymentTerms,
    notes: quote.notes,
    sections: sections.map((s, i) => {
      const ref = `S${i + 1}`;
      sectionByRef.set(ref, s);
      return {
        ref,
        title: s.title,
        optional: s.isOptional,
        items: items
          .filter((it) => it.sectionId === s.id)
          .map((it) => {
            const r = `V${++v}`;
            itemByRef.set(r, it);
            return { ref: r, text: it.description, quantity: it.quantity, unit: it.unitOfMeasure, price: it.unitPrice || null };
          }),
      };
    }),
  };
  return { agent, sectionByRef, itemByRef, sections, items, quote, client: client ?? null };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Applica le operazioni; restituisce cosa è cambiato (per l'utente) e l'annulla. */
export async function applyAgentOps(quoteId: string, loaded: LoadedQuote, ops: AgentOp[]) {
  const undo: AgentUndo = { createdSections: [], createdItems: [], sections: [], items: [], createdClients: [], clients: [] };
  let currentClient = loaded.client;
  const q0 = loaded.quote;
  const rememberQuote = () => {
    if (!undo.quote) {
      undo.quote = { clientId: q0.clientId, title: q0.title, vatRate: q0.vatRate, discountType: q0.discountType, discountValue: q0.discountValue, validUntil: q0.validUntil, paymentTerms: q0.paymentTerms, projectAddress: q0.projectAddress, notes: q0.notes };
    }
  };
  const clientFields = (op: { address?: string | null; vatNumber?: string | null; email?: string | null; phone?: string | null }) => {
    const set: Partial<ClientRow> = {};
    for (const k of ["address", "vatNumber", "email", "phone"] as const) if (op[k]) set[k] = op[k];
    return set;
  };
  const summary: string[] = [];
  const sectionByRef = new Map(loaded.sectionByRef);
  const sections = [...loaded.sections];
  const touchedSections = new Set<string>();
  const touchedItems = new Set<string>();
  const remember = {
    section(row: SectionRow) {
      if (touchedSections.has(row.id) || undo.createdSections.includes(row.id)) return;
      touchedSections.add(row.id);
      undo.sections.push(row);
    },
    item(row: ItemRow) {
      if (touchedItems.has(row.id) || undo.createdItems.includes(row.id)) return;
      touchedItems.add(row.id);
      undo.items.push(row);
    },
  };
  const nextOrder = (sectionId: string) =>
    loaded.items.filter((i) => i.sectionId === sectionId).length + undo.createdItems.length + 1;

  async function createSection(title: string, optional: boolean) {
    const used = new Set(sections.map((s) => s.code));
    const code = [...LETTERS].find((l) => !used.has(l)) ?? String(sections.length + 1);
    const id = await upsertSection(quoteId, { code, title, orderIndex: sections.length, isOptional: optional, isOptionalIncluded: false });
    const row = { id, quoteId, code, title, description: null, orderIndex: sections.length, sectionNote: null, isOptional: optional, isOptionalIncluded: false, lumpSum: false, lumpSumPrice: null } satisfies SectionRow;
    sections.push(row);
    undo.createdSections.push(id);
    return row;
  }

  async function resolveSection(key: string) {
    const byRef = sectionByRef.get(key.toUpperCase());
    if (byRef) return byRef;
    const byTitle = sections.find((s) => s.title.toLowerCase() === key.toLowerCase());
    if (byTitle) return byTitle;
    return createSection(key, false);
  }

  for (const op of ops) {
    switch (op.op) {
      case "add_section": {
        const row = await createSection(op.title, !!op.optional);
        if (op.ref) sectionByRef.set(op.ref.toUpperCase(), row);
        summary.push(`Nuova sezione «${op.title}»${op.optional ? " (opzionale)" : ""}`);
        break;
      }
      case "update_section": {
        const row = sectionByRef.get(op.section.toUpperCase());
        if (!row) break;
        remember.section(row);
        await upsertSection(quoteId, { ...row, title: op.title ?? row.title, isOptional: op.optional ?? row.isOptional });
        summary.push(`Sezione «${op.title ?? row.title}» aggiornata${op.optional != null ? (op.optional ? " (ora opzionale)" : " (non più opzionale)") : ""}`);
        break;
      }
      case "remove_section": {
        const row = sectionByRef.get(op.section.toUpperCase());
        if (!row) break;
        remember.section(row);
        for (const it of loaded.items.filter((i) => i.sectionId === row.id)) remember.item(it);
        await db.delete(quoteSections).where(eq(quoteSections.id, row.id));
        summary.push(`Tolta la sezione «${row.title}»`);
        break;
      }
      case "add_item": {
        const section = await resolveSection(op.section);
        const id = await upsertItem(section.id, {
          description: op.text,
          unitOfMeasure: op.unit ?? "a corpo",
          quantity: op.quantity ?? 1,
          unitPrice: op.price ?? 0,
          discount: 0,
          orderIndex: nextOrder(section.id),
        });
        undo.createdItems.push(id);
        summary.push(`Aggiunta «${op.text.slice(0, 80)}»${op.price ? ` a ${op.price} €` : ""}`);
        break;
      }
      case "update_item": {
        const row = loaded.itemByRef.get(op.item.toUpperCase());
        if (!row) break;
        remember.item(row);
        const target = op.section ? await resolveSection(op.section) : null;
        await upsertItem(target?.id ?? row.sectionId, {
          id: row.id,
          description: op.text ?? row.description,
          unitOfMeasure: op.unit ?? row.unitOfMeasure,
          quantity: op.quantity ?? row.quantity,
          unitPrice: op.price ?? row.unitPrice,
          discount: row.discount,
          notes: row.notes,
          orderIndex: row.orderIndex,
        });
        if (target && target.id !== row.sectionId) await db.update(quoteItems).set({ sectionId: target.id }).where(eq(quoteItems.id, row.id));
        const what = [op.text && "descrizione", op.quantity != null && "quantità", op.unit && "unità", op.price != null && `prezzo ${op.price} €`, target && "sezione"].filter(Boolean).join(", ");
        summary.push(`Modificata «${row.description.slice(0, 60)}»${what ? `: ${what}` : ""}`);
        break;
      }
      case "remove_item": {
        const row = loaded.itemByRef.get(op.item.toUpperCase());
        if (!row) break;
        remember.item(row);
        await db.delete(quoteItems).where(eq(quoteItems.id, row.id));
        summary.push(`Tolta «${row.description.slice(0, 60)}»`);
        break;
      }
      case "set_client": {
        rememberQuote();
        const name = op.name.trim();
        const [existing] = await db.select().from(clients).where(sql`lower(trim(${clients.name})) = ${name.toLowerCase()}`).limit(1);
        const fields = clientFields(op);
        let row: ClientRow;
        if (existing) {
          if (Object.keys(fields).length) {
            if (!undo.clients!.some((c) => c.id === existing.id)) undo.clients!.push(existing);
            await db.update(clients).set(fields).where(eq(clients.id, existing.id));
          }
          row = { ...existing, ...fields };
          summary.push(`Cliente: ${existing.name} (già in rubrica)`);
        } else {
          const id = generateId();
          await db.insert(clients).values({ id, name, ...fields });
          undo.createdClients!.push(id);
          row = { id, name, address: null, vatNumber: null, email: null, phone: null, notes: null, createdAt: new Date().toISOString(), ...fields } as ClientRow;
          summary.push(`Nuovo cliente «${name}» creato`);
        }
        await updateQuoteField(quoteId, { clientId: row.id });
        currentClient = row;
        break;
      }
      case "update_client": {
        if (!currentClient) break;
        const set: Partial<ClientRow> = clientFields(op);
        if (op.name) set.name = op.name.trim();
        if (!Object.keys(set).length) break;
        if (!undo.createdClients!.includes(currentClient.id) && !undo.clients!.some((c) => c.id === currentClient!.id)) undo.clients!.push(currentClient);
        await db.update(clients).set(set).where(eq(clients.id, currentClient.id));
        const what = [set.name && "nome", set.address && "indirizzo", set.phone && "telefono", set.email && "email", set.vatNumber && "P.IVA/CF"].filter(Boolean).join(", ");
        summary.push(`Cliente «${set.name ?? currentClient.name}» aggiornato: ${what}`);
        currentClient = { ...currentClient, ...set };
        break;
      }
      case "add_note":
      case "set_quote": {
        rememberQuote();
        if (op.op === "add_note") {
          const [cur] = await db.select({ notes: quotes.notes }).from(quotes).where(eq(quotes.id, quoteId)).limit(1);
          await updateQuoteField(quoteId, { notes: [cur?.notes?.trim(), op.text].filter(Boolean).join("\n") });
          summary.push(`Nota: ${op.text.slice(0, 80)}`);
        } else {
          const set: Partial<typeof quotes.$inferInsert> = {};
          if (op.title) set.title = op.title;
          if (op.vatRate != null) set.vatRate = op.vatRate;
          if (op.discountPercent !== undefined) {
            set.discountType = op.discountPercent ? "percent" : null;
            set.discountValue = op.discountPercent || null;
          }
          if (op.validUntil !== undefined) set.validUntil = op.validUntil;
          if (op.paymentTerms !== undefined) set.paymentTerms = op.paymentTerms;
          if (op.address !== undefined) set.projectAddress = op.address;
          if (Object.keys(set).length) {
            await updateQuoteField(quoteId, set);
            summary.push(
              [set.title && `titolo «${set.title}»`, set.vatRate != null && `IVA ${set.vatRate}%`, op.discountPercent !== undefined && `sconto ${op.discountPercent ?? 0}%`,
               set.validUntil !== undefined && "validità", set.paymentTerms !== undefined && "pagamenti", set.projectAddress !== undefined && "indirizzo"]
                .filter(Boolean)
                .join(", ")
                .replace(/^./, (c) => c.toUpperCase())
            );
          }
        }
        break;
      }
    }
  }
  if (ops.length) await updateQuoteField(quoteId, {});
  return { summary, undo };
}

/** Riporta il preventivo a prima del comando vocale. */
export async function undoAgentOps(quoteId: string, undo: AgentUndo) {
  if (undo.createdItems.length) await db.delete(quoteItems).where(inArray(quoteItems.id, undo.createdItems));
  if (undo.createdSections.length) await db.delete(quoteSections).where(inArray(quoteSections.id, undo.createdSections));
  for (const s of undo.sections) {
    await upsertSection(quoteId, { ...s, id: s.id });
  }
  for (const it of undo.items) {
    await upsertItem(it.sectionId, { ...it, id: it.id });
    await db.update(quoteItems).set({ sectionId: it.sectionId }).where(eq(quoteItems.id, it.id));
  }
  if (undo.quote) await updateQuoteField(quoteId, undo.quote);
  else await updateQuoteField(quoteId, {});
  for (const c of undo.clients ?? []) {
    await db.update(clients).set({ name: c.name, address: c.address, vatNumber: c.vatNumber, email: c.email, phone: c.phone, notes: c.notes }).where(eq(clients.id, c.id));
  }
  // Clienti creati dal comando: si tolgono solo se nessun preventivo li usa più.
  for (const id of undo.createdClients ?? []) {
    const [used] = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.clientId, id)).limit(1);
    if (!used) await db.delete(clients).where(eq(clients.id, id));
  }
}
