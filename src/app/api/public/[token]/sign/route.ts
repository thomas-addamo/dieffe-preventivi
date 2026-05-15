import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes, quoteSignatures, companySettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isTokenValid } from "@/lib/public-token";
import { sendSignatureNotification } from "@/lib/email/send";

const SIG_MAX_BYTES = 500 * 1024; // 500KB

const bodySchema = z.object({
  signerName: z.string().min(2).max(100),
  signatureDataUrl: z
    .string()
    .refine((v) => v === "" || v.startsWith("data:image/png;base64,"), {
      message: "signatureDataUrl must be a PNG data URL",
    })
    .refine((v) => Buffer.byteLength(v, "utf8") <= SIG_MAX_BYTES, {
      message: "Signature too large",
    })
    .optional()
    .default(""),
  action: z.enum(["accepted", "rejected"]),
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

  const { signerName, signatureDataUrl, action } = parsed.data;

  // For accepted action, signature is required
  if (action === "accepted" && !signatureDataUrl) {
    return NextResponse.json({ error: "Firma richiesta per accettare" }, { status: 400 });
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const signedAt = new Date();

  // neon-http driver doesn't support transactions — run sequentially
  await db.insert(quoteSignatures).values({
    quoteId: quote.id,
    signerName,
    signatureDataUrl: signatureDataUrl ?? "",
    ipAddress,
    userAgent,
    signedAt,
    action,
  });

  await db
    .update(quotes)
    .set({
      status: action,
      publicTokenExpiresAt: new Date(), // expire immediately
    })
    .where(eq(quotes.id, quote.id));

  // Send email notification (non-blocking, failures don't affect the response)
  (async () => {
    try {
      const [settings] = await db.select().from(companySettings).limit(1);
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
    } catch {
      // Email failure must never break the response
    }
  })();

  return NextResponse.json({ success: true, action });
}
