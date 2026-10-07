import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, like } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, quotes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";

// Lavori extra di un preventivo: preventivi separati, con le stesse
// intestazioni (cliente, cantiere, IVA, condizioni), che contengono solo le
// lavorazioni aggiuntive e hanno un prezzo proprio. Codice: PREV-2026-014-E1.

type Params = { params: Promise<{ id: string }> };

/** Elenco dei lavori extra del preventivo. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  const rows = await db
    .select({ id: quotes.id, code: quotes.code, title: quotes.title, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.parentQuoteId, id), isNull(quotes.deletedAt)))
    .orderBy(quotes.createdAt);
  return NextResponse.json(rows);
}

/** Crea un nuovo lavoro extra partendo dal preventivo principale. */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const [parent] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!parent || parent.deletedAt)
    return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  // Un extra si aggancia sempre al preventivo principale, mai a un altro extra.
  const root =
    parent.kind === "extra" && parent.parentQuoteId
      ? ((await db.select().from(quotes).where(eq(quotes.id, parent.parentQuoteId)).limit(1))[0] ?? parent)
      : parent;

  // Numerazione progressiva per preventivo (anche quelli nel cestino, per non
  // riusare mai un codice).
  const existing = await db
    .select({ code: quotes.code })
    .from(quotes)
    .where(like(quotes.code, `${root.code}-E%`));
  const n =
    existing.reduce((max, r) => Math.max(max, Number(r.code.slice(root.code.length + 2)) || 0), 0) + 1;

  const newId = generateId();
  await db.insert(quotes).values({
    id: newId,
    code: `${root.code}-E${n}`,
    title: `Lavori extra — ${root.title}`,
    kind: "extra",
    parentQuoteId: root.id,
    clientId: root.clientId,
    userId: session.user.id,
    projectAddress: root.projectAddress,
    vatRate: root.vatRate,
    paymentTerms: root.paymentTerms,
    validUntil: null,
    notes: null,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.extra_created",
    entityType: "quote",
    entityId: newId,
    changes: { parentQuoteId: root.id },
  });

  return NextResponse.json({ id: newId }, { status: 201 });
}
