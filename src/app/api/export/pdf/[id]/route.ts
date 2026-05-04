import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { ClassicTemplate } from "@/components/pdf-templates/ClassicTemplate";
import { generateExportFilename } from "@/lib/utils";
import { cloudinary } from "@/lib/cloudinary";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session)
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const quote = await getQuoteWithRelations(id);
  if (!quote)
    return NextResponse.json(
      { error: "Preventivo non trovato" },
      { status: 404 }
    );

  const [settings] = await db.select().from(companySettings).limit(1);
  const s = settings ?? null;

  // logoPath contiene il public_id di Cloudinary; generiamo l'URL ottimizzato
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ClassicTemplate as any, {
    quote,
    settings: s,
    logoUrl,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const filename = generateExportFilename(quote.code, quote.title, "pdf");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
