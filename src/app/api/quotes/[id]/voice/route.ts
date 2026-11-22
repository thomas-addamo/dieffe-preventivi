import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { checkQuoteEditable } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { auditLog, clients } from "@/lib/db/schema";
import { aiDisabledResponse } from "@/lib/ai/guard";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";
import { agentSystemPrompt, quoteForPrompt, sanitizeAgentOps } from "@/lib/ai/quote-agent";
import { applyAgentOps, loadQuoteForAgent, undoAgentOps, type AgentUndo } from "@/lib/ai/quote-agent-apply";
import { generateId } from "@/lib/utils";

// Comando vocale su un preventivo esistente (D1c, iPhone): il tecnico dice cosa
// cambiare, l'IA decide le operazioni e si applicano subito. Ogni comando si
// può annullare (DELETE con l'id restituito): lo stato precedente è nel registro.

export const maxDuration = 30;

const schema = z.object({ text: z.string().trim().min(2).max(4000) });

async function guardRequest(id: string) {
  const session = await getCurrentUser();
  if (!session) return { error: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }) };
  if (session.user.role === "viewer") return { error: NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 }) };
  const guard = await checkQuoteEditable(id, session.user.role);
  if (!guard.ok) return { error: NextResponse.json({ error: guard.error }, { status: guard.status }) };
  return { session };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardRequest(id);
  if (error) return error;
  const aiOff = await aiDisabledResponse();
  if (aiOff) return aiOff;
  if (!isAiConfigured()) return NextResponse.json({ error: "IA non configurata" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const { text } = parsed.data;

  const base = await loadQuoteForAgent(id, null);
  if (!base) return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  if (base.quote.clientId) {
    const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, base.quote.clientId)).limit(1);
    base.agent.client = c?.name ?? null;
  }

  let ops;
  try {
    const prompt = `PREVENTIVO ATTUALE:\n${quoteForPrompt(base.agent)}\n\nCOMANDO DEL TECNICO:\n«${text}»`;
    const raw = await generateAIJson<unknown>(agentSystemPrompt("command"), prompt, 25000, 1600, { smart: true });
    ops = sanitizeAgentOps(raw, text, base.agent);
  } catch (err) {
    console.error("[comando vocale] IA non riuscita:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "L'IA non risponde, riprova tra poco" }, { status: 502 });
  }
  if (!ops.length) return NextResponse.json({ changes: [], undoId: null });

  const { summary, undo } = await applyAgentOps(id, base, ops);
  const undoId = generateId();
  await db.insert(auditLog).values({
    id: undoId,
    userId: session.user.id,
    action: "quote.voice_command",
    entityType: "quote",
    entityId: id,
    changes: { text: text.slice(0, 500), summary, undo },
  });
  return NextResponse.json({ changes: summary, undoId });
}

/** Annulla un comando vocale: ?undo=<id>. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardRequest(id);
  if (error) return error;
  const undoId = req.nextUrl.searchParams.get("undo");
  if (!undoId) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const [row] = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.id, undoId), eq(auditLog.entityId, id), eq(auditLog.action, "quote.voice_command")))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  const changes = row?.changes as { undo?: AgentUndo; undone?: boolean } | null;
  if (!changes?.undo) return NextResponse.json({ error: "Niente da annullare" }, { status: 404 });
  if (changes.undone) return NextResponse.json({ ok: true });
  await undoAgentOps(id, changes.undo);
  await db.update(auditLog).set({ changes: { ...changes, undone: true, undoneBy: session.user.id } }).where(eq(auditLog.id, undoId));
  return NextResponse.json({ ok: true });
}
