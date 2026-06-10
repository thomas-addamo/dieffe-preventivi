import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/lib/db/client";
import { quotes, quoteSections, quoteItems, quoteItemImages, clients, companySettings, quoteSignatures } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { isTokenValid, verifyPin } from "@/lib/public-token";
import { ClassicTemplate } from "@/components/pdf-templates/ClassicTemplate";
import { generateExportFilename } from "@/lib/utils";
import { cloudinary } from "@/lib/cloudinary";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [row] = await db
    .select()
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .where(eq(quotes.publicToken, token))
    .limit(1);

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const validity = isTokenValid(row.quotes.publicToken, row.quotes.publicTokenExpiresAt, row.quotes.status);
  if (!validity.valid && validity.reason !== "closed") {
    return NextResponse.json({ error: "link_expired" }, { status: 410 });
  }

  // Stesso gate PIN della pagina: il PDF non deve essere scaricabile senza PIN.
  if (row.quotes.publicPin) {
    const providedPin =
      req.headers.get("x-public-pin") ??
      new URL(req.url).searchParams.get("pin") ??
      "";
    if (!providedPin || !verifyPin(providedPin, row.quotes.publicPin)) {
      return NextResponse.json({ error: "pin_required" }, { status: 401 });
    }
  }

  const sections = await db
    .select()
    .from(quoteSections)
    .where(eq(quoteSections.quoteId, row.quotes.id))
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

  const signatures = await db
    .select()
    .from(quoteSignatures)
    .where(eq(quoteSignatures.quoteId, row.quotes.id))
    .orderBy(asc(quoteSignatures.signedAt))
    .limit(1);

  const [settings] = await db.select().from(companySettings).limit(1);

  let logoUrl: string | null = null;
  if (settings?.logoPath) {
    logoUrl = cloudinary.url(settings.logoPath, {
      fetch_format: "auto",
      quality: "auto",
      width: 280,
      crop: "limit",
      secure: true,
    });
  }

  const sectionsWithItems = sections.map((section) => ({
    ...section,
    items: items
      .filter((i) => i.sectionId === section.id)
      .map((item) => ({
        ...item,
        images: images.filter((img) => img.itemId === item.id),
      })),
  }));

  const quote = {
    ...row.quotes,
    client: row.clients ?? null,
    author: { id: "", name: "", email: "" },
    sections: sectionsWithItems,
    signature: signatures[0] ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ClassicTemplate as any, {
    quote,
    settings: settings ?? null,
    logoUrl,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const filename = generateExportFilename(row.quotes.code, row.quotes.title, "pdf");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
