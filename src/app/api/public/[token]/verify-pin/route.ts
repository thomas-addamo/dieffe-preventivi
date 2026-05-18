import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isTokenValid, verifyPin } from "@/lib/public-token";

const MAX_ATTEMPTS = 5;
const pinRateMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const now = Date.now();
  const key = `pin:${token}`;
  const entry = pinRateMap.get(key);

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      return NextResponse.json({ success: false, attemptsLeft: 0 }, { status: 429 });
    }
    entry.count++;
  } else {
    pinRateMap.set(key, { count: 1, resetAt: now + 3600_000 });
  }

  const currentEntry = pinRateMap.get(key)!;
  const attemptsLeft = MAX_ATTEMPTS - currentEntry.count;

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, token))
    .limit(1);

  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validity = isTokenValid(quote.publicToken, quote.publicTokenExpiresAt, quote.status);
  if (!validity.valid) {
    return NextResponse.json({ error: "invalid_token" }, { status: 410 });
  }

  if (!quote.publicPin) {
    return NextResponse.json({ success: true });
  }

  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");

  if (verifyPin(pin, quote.publicPin)) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, attemptsLeft }, { status: 401 });
}
