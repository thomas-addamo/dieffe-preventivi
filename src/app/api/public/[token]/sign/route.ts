import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes, quoteSignatures, companySettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isTokenValid } from "@/lib/public-token";
import { sendSignatureNotification, sendClientSignatureConfirmation } from "@/lib/email/send";

const bodySchema = z.object({
  signerName: z.string().min(2).max(100),
  signerEmail: z.string().email(),
  signatureDataUrl: z.string().max(600_000).optional().default(""),
  action: z.enum(["accepted", "rejected"]),
  ipConsent: z.boolean().refine((v) => v === true, {
    message: "Il consenso IP è obbligatorio",
  }),
  clientIp: z.string().optional(),
});

// Simple in-memory rate limiter: 3 attempts per token per hour
const signRateMap = new Map<string, { count: number; resetAt: number }>();
function checkSignRateLimit(token: string): boolean {
  const now = Date.now();
  const key = `sign:${token}`;
  const entry = signRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    signRateMap.set(key, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!checkSignRateLimit(token)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, token))
    .limit(1);

  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validity = isTokenValid(quote.publicToken, quote.publicTokenExpiresAt, quote.status);
  if (!validity.valid) {
    if (validity.reason === "expired")
      return NextResponse.json({ error: "link_expired" }, { status: 410 });
    if (validity.reason === "closed")
      return NextResponse.json({ error: "quote_closed", status: quote.status }, { status: 410 });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });

  const { signerName, signerEmail, signatureDataUrl, action, ipConsent, clientIp } = parsed.data;

  if (action === "accepted" && !signatureDataUrl) {
    return NextResponse.json({ error: "Firma richiesta per accettare" }, { status: 400 });
  }

  // IP is always resolved server-side (authoritative)
  const rawServerIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // Filter loopback — only occurs in local dev, never on Vercel
  const isLoopback = !rawServerIp || rawServerIp === "::1" || rawServerIp === "127.0.0.1" || rawServerIp === "::ffff:127.0.0.1";
  const serverIp = isLoopback ? null : rawServerIp;

  const ipAddress = serverIp ?? clientIp ?? null;

  if (!ipAddress) {
    console.warn("Sign attempt with no IP resolvable, proceeding anyway");
  }

  const userAgent = req.headers.get("user-agent") ?? null;
  const signedAt = new Date();

  // neon-http driver doesn't support transactions — run sequentially
  await db.insert(quoteSignatures).values({
    quoteId: quote.id,
    signerName,
    signerEmail,
    signatureDataUrl: signatureDataUrl ?? "",
    ipAddress,
    ipConsent,
    userAgent,
    signedAt,
    action,
  });

  await db
    .update(quotes)
    .set({
      status: action,
      publicTokenExpiresAt: new Date(), // expire immediately after signing
    })
    .where(eq(quotes.id, quote.id));

  const [settings] = await db.select().from(companySettings).limit(1);

  try {
    await sendClientSignatureConfirmation({
      quoteId: quote.id,
      quoteCode: quote.code,
      quoteTitle: quote.title,
      signerName,
      signerEmail,
      action,
      signedAt,
      fromEmail: settings?.emailFromAddress ?? "onboarding@resend.dev",
      companyName: settings?.companyName ?? "Dieffe Ristrutturazioni",
      companyEmail: settings?.email ?? null,
      companyPhone: settings?.phone ?? null,
      companyWebsite: settings?.website ?? null,
    });
    console.log('[EMAIL] ✅ Client email sent');
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[EMAIL] ❌ Client email failed:', error.message, error.stack);
  }

  try {
    const recipientEmail = settings?.email ?? "impresa.dieffe@gmail.com";
    await sendSignatureNotification({
      quoteCode: quote.code,
      quoteTitle: quote.title,
      quoteId: quote.id,
      signerName,
      action,
      signedAt,
      ipAddress,
      recipientEmail,
    });
    console.log('[EMAIL] ✅ Admin email sent');
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[EMAIL] ❌ Admin email failed:', error.message, error.stack);
  }

  return NextResponse.json({ success: true, action });
}
