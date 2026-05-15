import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/lib/db/client";
import { companySettings, quoteSignatures } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { ClassicTemplate } from "@/components/pdf-templates/ClassicTemplate";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { cloudinary } from "@/lib/cloudinary";

export async function generateQuotePdfBuffer(
  quoteId: string,
  options: { includeIp?: boolean } = {}
): Promise<Buffer> {
  const { includeIp = true } = options;

  const quote = await getQuoteWithRelations(quoteId);
  if (!quote) throw new Error(`Quote ${quoteId} not found`);

  const [settings] = await db.select().from(companySettings).limit(1);
  const s = settings ?? null;

  const [sig] = await db
    .select()
    .from(quoteSignatures)
    .where(eq(quoteSignatures.quoteId, quoteId))
    .orderBy(asc(quoteSignatures.signedAt))
    .limit(1);

  let logoUrl: string | null = null;
  if (s?.logoPath) {
    logoUrl = cloudinary.url(s.logoPath, {
      fetch_format: "auto",
      quality: "auto",
      width: 280,
      crop: "limit",
      secure: true,
    });
  }

  // Strip IP for client-facing PDF
  const signature = sig
    ? { ...sig, ipAddress: includeIp ? sig.ipAddress : null }
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ClassicTemplate as any, {
    quote: { ...quote, signature },
    settings: s,
    logoUrl,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await renderToBuffer(element as any)) as unknown as Buffer;
}
