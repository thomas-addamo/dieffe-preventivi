import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, quoteSections, quoteItems, quoteItemImages, clients, companySettings } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { isTokenValid, verifyPin } from "@/lib/public-token";

// Simple in-memory rate limiter: 60 req per token per hour
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(identifier: string, max: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    rateMap.set(identifier, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!checkRateLimit(`view:${token}`, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const [quote] = await db
    .select()
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .where(eq(quotes.publicToken, token))
    .limit(1);

  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validity = isTokenValid(
    quote.quotes.publicToken,
    quote.quotes.publicTokenExpiresAt,
    quote.quotes.status
  );

  if (!validity.valid) {
    const status = 410;
    if (validity.reason === "not_generated")
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (validity.reason === "expired")
      return NextResponse.json({ error: "link_expired" }, { status });
    return NextResponse.json({ error: "quote_closed", status: quote.quotes.status }, { status });
  }

  // Il PIN è verificato LATO SERVER: senza PIN valido la risposta non contiene
  // i dati del preventivo, solo le info minime per mostrare la schermata PIN.
  if (quote.quotes.publicPin) {
    const providedPin =
      req.headers.get("x-public-pin") ??
      new URL(req.url).searchParams.get("pin") ??
      "";
    if (!providedPin || !verifyPin(providedPin, quote.quotes.publicPin)) {
      const [settingsRow] = await db.select().from(companySettings).limit(1);
      return NextResponse.json({
        requiresPin: true,
        quote: null,
        settings: settingsRow
          ? {
              companyName: settingsRow.companyName,
              logoPath: settingsRow.logoPath,
              address: settingsRow.address,
              email: settingsRow.email,
              phone: settingsRow.phone,
              website: settingsRow.website,
              vatNumber: settingsRow.vatNumber,
              primaryColor: settingsRow.primaryColor,
              accentColor: settingsRow.accentColor,
            }
          : null,
      });
    }
  }

  const sections = await db
    .select()
    .from(quoteSections)
    .where(eq(quoteSections.quoteId, quote.quotes.id))
    .orderBy(asc(quoteSections.orderIndex));

  const items =
    sections.length > 0
      ? await db
          .select()
          .from(quoteItems)
          .where(inArray(quoteItems.sectionId, sections.map((s) => s.id)))
          .orderBy(asc(quoteItems.orderIndex))
      : [];

  const images =
    items.length > 0
      ? await db
          .select()
          .from(quoteItemImages)
          .where(inArray(quoteItemImages.itemId, items.map((i) => i.id)))
          .orderBy(asc(quoteItemImages.orderIndex))
      : [];

  const [settings] = await db.select().from(companySettings).limit(1);

  const sectionsWithItems = sections.map((section) => ({
    ...section,
    items: items
      .filter((i) => i.sectionId === section.id)
      .map((item) => ({
        ...item,
        images: images.filter((img) => img.itemId === item.id),
      })),
  }));

  // Se siamo arrivati qui il PIN è assente o già verificato.
  return NextResponse.json({
    requiresPin: false,
    quote: {
      id: quote.quotes.id,
      code: quote.quotes.code,
      title: quote.quotes.title,
      status: quote.quotes.status,
      projectAddress: quote.quotes.projectAddress,
      vatRate: quote.quotes.vatRate,
      discountType: quote.quotes.discountType,
      discountValue: quote.quotes.discountValue,
      notes: quote.quotes.notes,
      paymentTerms: quote.quotes.paymentTerms,
      validUntil: quote.quotes.validUntil,
      createdAt: quote.quotes.createdAt,
      publicTokenExpiresAt: quote.quotes.publicTokenExpiresAt,
      client: quote.clients
        ? {
            name: quote.clients.name,
            address: quote.clients.address,
          }
        : null,
      sections: sectionsWithItems,
    },
    settings: settings
      ? {
          companyName: settings.companyName,
          logoPath: settings.logoPath,
          address: settings.address,
          email: settings.email,
          phone: settings.phone,
          website: settings.website,
          vatNumber: settings.vatNumber,
          primaryColor: settings.primaryColor,
          accentColor: settings.accentColor,
        }
      : null,
  });
}
