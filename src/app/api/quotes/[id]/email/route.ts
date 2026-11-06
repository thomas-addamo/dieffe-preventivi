import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, clients, quotes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { generateId, generateExportFilename, QUOTE_STATUS_LABELS } from "@/lib/utils";
import { computeExpiresAt, generatePin, generatePublicToken, hashPin } from "@/lib/public-token";
import { generateQuotePdfBuffer } from "@/lib/exporters/pdf";
import { gmailAddress, isGmailConfigured, sendGmail } from "@/lib/email/gmail";
import {
  buildContent,
  formatExpires,
  isQuoteClosed,
  loadQuoteEmailContext,
  renderQuoteEmail,
} from "@/lib/email/quote/compose";
import { quoteEmailMessage, quoteEmailPinLine, quoteEmailSubject } from "@/lib/email/quote/text";
import { notifyQuoteStatusChanged } from "@/lib/notifications";
import { queueSiteSync } from "@/lib/sites/sync";

export const maxDuration = 60;

// Invio del preventivo al cliente per email dalla casella ufficiale.
//   GET                → bozza pronta (oggetto, testo, destinatari, stato link)
//   POST ?preview=1    → HTML della mail com'è, senza inviare né salvare nulla
//   POST               → genera PDF (+ link/codice se servono), invia, registra
// Nessuna tabella nuova: l'invio finisce nello storico (audit_log) e la mail
// resta comunque in "Inviati" su Gmail.

const MAX_RECIPIENTS = 10;

async function auth(id: string) {
  const session = await getCurrentUser();
  if (!session) return { error: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }) };
  if (session.user.role === "viewer")
    return { error: NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 }) };
  const ctx = await loadQuoteEmailContext(id);
  if (!ctx || ctx.quote.deletedAt)
    return { error: NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 }) };
  return { session, ctx };
}

function linkState(q: { publicToken: string | null; publicTokenExpiresAt: Date | string | null }) {
  const active = !!q.publicToken && !!q.publicTokenExpiresAt && new Date(q.publicTokenExpiresAt) > new Date();
  return {
    active,
    url: active ? `${env.APP_URL}/p/${q.publicToken}` : null,
    expiresAt: active ? new Date(q.publicTokenExpiresAt!).toISOString() : null,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await auth(id);
  if ("error" in a) return a.error;
  const { quote, companyName } = a.ctx;

  const contacts = await db
    .select({ id: clients.id, name: clients.name, email: clients.email })
    .from(clients)
    .where(and(isNotNull(clients.email), ne(clients.email, "")))
    .orderBy(asc(clients.name));

  return NextResponse.json({
    configured: isGmailConfigured(),
    from: { name: companyName, address: gmailAddress() },
    subject: quoteEmailSubject({ code: quote.code, title: quote.title, companyName }),
    message: quoteEmailMessage({ clientName: quote.client?.name ?? null, title: quote.title }),
    to: quote.client?.email ? [{ name: quote.client.name, email: quote.client.email }] : [],
    contacts,
    status: quote.status,
    closed: isQuoteClosed(quote),
    link: { ...linkState(quote), days: quote.publicTokenDays ?? 30 },
  });
}

const email = z.string().trim().toLowerCase().email();
const bodySchema = z.object({
  to: z.array(email).min(1).max(MAX_RECIPIENTS),
  copies: z.array(email).max(MAX_RECIPIENTS).default([]),
  copyMode: z.enum(["cc", "bcc"]).default("cc"),
  subject: z.string().trim().min(1).max(250),
  message: z.string().trim().min(1).max(5000),
  notes: z.string().trim().max(5000).nullable().optional(),
  pinMode: z.enum(["personal", "attach"]).default("personal"),
  /** Con "personal" e link già attivo: genera comunque un nuovo codice. */
  newPin: z.boolean().default(false),
  linkDays: z.number().int().min(1).max(365).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const a = await auth(id);
  if ("error" in a) return a.error;
  const { session, ctx } = a;
  const { quote } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const bad = parsed.error.issues.some((i) => i.path[0] === "to" || i.path[0] === "copies");
    return NextResponse.json(
      { error: bad ? "Controlla gli indirizzi email dei destinatari" : "Dati non validi" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const to = [...new Set(input.to)];
  const copies = [...new Set(input.copies)].filter((e) => !to.includes(e));
  if (to.length + copies.length > MAX_RECIPIENTS)
    return NextResponse.json({ error: `Massimo ${MAX_RECIPIENTS} destinatari per invio` }, { status: 400 });

  if (!preview && !isGmailConfigured())
    return NextResponse.json(
      { error: "Invio email non ancora configurato: manca la password per le app di Gmail." },
      { status: 503 }
    );

  // ── Link pubblico e codice di accesso ─────────────────────────────────────
  // Il codice è salvato cifrato: si conosce in chiaro solo quando lo si genera.
  const closed = isQuoteClosed(quote);
  const current = linkState(quote);
  let token = quote.publicToken;
  let expiresAt = current.expiresAt ? new Date(current.expiresAt) : null;
  let pin: string | null = null;
  let linkUpdate: Partial<typeof quotes.$inferInsert> | null = null;
  if (!closed) {
    if (!current.active) {
      const days = input.linkDays ?? quote.publicTokenDays ?? 30;
      token = generatePublicToken();
      expiresAt = computeExpiresAt(days);
      pin = generatePin();
      linkUpdate = { publicToken: token, publicTokenExpiresAt: expiresAt, publicTokenDays: days, publicPin: hashPin(pin) };
    } else if (input.pinMode === "attach" || input.newPin || !quote.publicPin) {
      pin = generatePin();
      linkUpdate = { publicPin: hashPin(pin) };
    }
  }

  const fromAddress = gmailAddress();
  const content = buildContent(ctx, {
    message: input.message,
    notes: input.notes ?? null,
    senderName: session.user.name,
    fromAddress,
    link:
      closed || !expiresAt
        ? null
        : {
            url: `${env.APP_URL}/p/${preview && !current.active ? "…" : token}`,
            expiresLabel: formatExpires(expiresAt),
            pinLine: quoteEmailPinLine(input.pinMode, preview ? "000000" : pin),
          },
  });
  if (preview && content.link && input.pinMode === "attach")
    content.link.pinLine = "Codice di accesso: ••• •••";

  const { html, text } = await renderQuoteEmail(ctx, content);
  if (preview) return NextResponse.json({ html, pinWillChange: !!linkUpdate && current.active });

  // Il nuovo link/codice si salva PRIMA dell'invio: ciò che riceve il cliente
  // deve essere già valido.
  if (linkUpdate) await db.update(quotes).set(linkUpdate).where(eq(quotes.id, id));

  let messageId: string;
  try {
    const pdf = await generateQuotePdfBuffer(id, { includeIp: false, quote });
    ({ messageId } = await sendGmail({
      fromName: ctx.companyName,
      to,
      ...(copies.length ? { [input.copyMode]: copies } : {}),
      subject: input.subject,
      html,
      text,
      attachments: [
        {
          filename: generateExportFilename(quote.code, quote.title, "pdf"),
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    }));
  } catch (err) {
    console.error("[quote-email] invio fallito:", err instanceof Error ? err.message : err);
    const authFail = err instanceof Error && /Invalid login|535|auth/i.test(err.message);
    return NextResponse.json(
      {
        error: authFail
          ? "Gmail ha rifiutato l'accesso: controlla la password per le app."
          : "Invio non riuscito. Riprova tra qualche istante.",
        pin: linkUpdate ? pin : null,
      },
      { status: 502 }
    );
  }

  const markSent = quote.status === "draft";
  const now = new Date().toISOString();
  const logEntry = db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.emailed",
    entityType: "quote",
    entityId: id,
    changes: {
      to,
      [input.copyMode]: copies,
      pin: input.pinMode,
      newPin: !!linkUpdate,
      messageId,
    },
  });
  if (markSent)
    await db.batch([
      db.update(quotes).set({ status: "sent", sentAt: now, updatedAt: now }).where(eq(quotes.id, id)),
      logEntry,
    ]);
  else await logEntry;

  if (markSent) {
    queueSiteSync();
    await notifyQuoteStatusChanged({
      quoteId: id,
      quoteCode: quote.code,
      ownerUserId: quote.userId,
      actorUserId: session.user.id,
      actorName: session.user.name,
      newStatusLabel: QUOTE_STATUS_LABELS.sent ?? "Inviato",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    recipients: to.length + copies.length,
    status: markSent ? "sent" : quote.status,
    // Il codice torna solo se è stato appena generato e NON era nella mail:
    // va comunicato al cliente di persona.
    pin: linkUpdate && input.pinMode === "personal" ? pin : null,
    link: linkUpdate
      ? { token, expiresAt: expiresAt?.toISOString() ?? null }
      : null,
  });
}
