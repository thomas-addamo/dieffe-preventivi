import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, notifications, quotes } from "@/lib/db/schema";
import { aiDisabledResponse } from "@/lib/ai/guard";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";

// Benvenuto personalizzato della dashboard: cosa è rimasto in sospeso per
// l'utente (dati reali) + un messaggio e qualche consiglio scritti dall'AI.
// Nessuna scrittura nel database: il testo dell'AI viene tenuto in cache dal
// browser per fascia oraria (?ai=0 chiede solo i dati).

export interface BriefingItem {
  id: string;
  code: string;
  title: string;
  clientName: string | null;
  /** draft = bozza da finire · followup = inviato senza risposta · signed = appena accettato */
  reason: "draft" | "followup" | "signed";
  days: number;
}

export interface BriefingResponse {
  firstName: string;
  pending: BriefingItem[];
  unread: number;
  ai: { message: string; tips: string[] } | null;
}

const DAY = 86_400_000;
const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { user } = session;
  const url = new URL(req.url);
  const wantAi = url.searchParams.get("ai") !== "0";
  const hour = Math.min(23, Math.max(0, Number(url.searchParams.get("hour")) || new Date().getHours()));

  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const base = { id: quotes.id, code: quotes.code, title: quotes.title, clientName: clients.name, updatedAt: quotes.updatedAt, sentAt: quotes.sentAt };

  const [drafts, waiting, signed, unread] = await Promise.all([
    // Bozze toccate nell'ultimo mese: "dove eri rimasto".
    db.select(base).from(quotes).leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(eq(quotes.userId, user.id), eq(quotes.status, "draft"), isNull(quotes.deletedAt), gte(quotes.updatedAt, since)))
      .orderBy(desc(quotes.updatedAt)).limit(3),
    // Inviati da più di una settimana senza risposta: da sollecitare.
    db.select(base).from(quotes).leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(eq(quotes.userId, user.id), eq(quotes.status, "sent"), isNull(quotes.deletedAt), lt(quotes.updatedAt, weekAgo)))
      .orderBy(quotes.updatedAt).limit(3),
    // Accettati negli ultimi 7 giorni.
    db.select(base).from(quotes).leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(eq(quotes.userId, user.id), eq(quotes.status, "accepted"), isNull(quotes.deletedAt), gte(quotes.updatedAt, weekAgo)))
      .orderBy(desc(quotes.updatedAt)).limit(2),
    db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))).limit(50),
  ]);

  const pending: BriefingItem[] = [
    ...drafts.map((q) => ({ ...q, reason: "draft" as const, days: days(q.updatedAt) })),
    ...waiting.map((q) => ({ ...q, reason: "followup" as const, days: days(q.sentAt ?? q.updatedAt) })),
    ...signed.map((q) => ({ ...q, reason: "signed" as const, days: days(q.updatedAt) })),
  ].map(({ id, code, title, clientName, reason, days }) => ({ id, code, title, clientName, reason, days }));

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  let ai: BriefingResponse["ai"] = null;

  if (wantAi && isAiConfigured() && !(await aiDisabledResponse())) {
    const moment =
      hour < 5 ? "notte fonda" : hour < 12 ? "mattina" : hour < 14 ? "ora di pranzo" : hour < 18 ? "pomeriggio" : hour < 22 ? "sera" : "tarda sera";
    const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "long", timeZone: "Europe/Rome" }).format(new Date());
    const facts = [
      `Utente: ${firstName} (ruolo ${user.role}). È ${weekday}, ${moment} (ore ${hour}).`,
      drafts.length ? `Bozze da completare: ${drafts.map((d) => `"${d.title}" (ferma da ${days(d.updatedAt)} gg)`).join("; ")}.` : "Nessuna bozza in sospeso.",
      waiting.length ? `Preventivi inviati senza risposta da oltre 7 giorni: ${waiting.map((w) => `"${w.title}"${w.clientName ? ` per ${w.clientName}` : ""}`).join("; ")}.` : "Nessun preventivo da sollecitare.",
      signed.length ? `Accettati questa settimana: ${signed.map((s) => `"${s.title}"`).join("; ")}.` : "",
      unread.length ? `Notifiche non lette: ${unread.length}.` : "",
    ].filter(Boolean).join("\n");
    const system = `Sei l'assistente di Dieffe Preventivi, l'app con cui l'impresa edile Dieffe Ristrutturazioni (Torino) prepara i preventivi.
Scrivi per la dashboard dell'utente un breve messaggio di benvenuto in italiano, caldo ma professionale, adatto al momento della giornata e al lavoro in un'impresa edile (cantieri, clienti, preventivi). Non ripetere il saluto ("Buongiorno, X" è già mostrato).
- "message": 1-2 frasi (max 220 caratteri) che motivano e indicano la priorità del momento in base ai dati.
- "tips": 2 consigli brevi e concreti (max 110 caratteri ciascuno) su cosa fare ora nell'app o con i clienti (es. sollecitare, completare una bozza, usare il listino, i lavori extra, le comunicazioni).
Non inventare dati che non sono nel contesto. Rispondi SOLO con JSON: {"message":"...","tips":["...","..."]}`;
    try {
      const out = await generateAIJson<{ message?: string; tips?: string[] }>(system, facts, 9000, 400);
      if (out?.message) {
        ai = {
          message: out.message.trim().slice(0, 260),
          tips: (out.tips ?? []).filter(Boolean).slice(0, 3).map((t) => t.trim().slice(0, 140)),
        };
      }
    } catch {
      ai = null;
    }
  }

  return NextResponse.json({ firstName, pending, unread: unread.length, ai } satisfies BriefingResponse);
}
