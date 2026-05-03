import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import path from "path";
import fs from "fs";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { ClassicTemplate } from "@/components/pdf-templates/ClassicTemplate";
import { generateExportFilename } from "@/lib/utils";

/** Convert a storage-relative URL like /storage/logo/logo.png → absolute FS path.
 *  Returns null if the file doesn't exist. */
function storageUrlToAbs(url: string | null | undefined): string | null {
  if (!url) return null;
  // strip query string (cache-busting tokens)
  const clean = url.split("?")[0];
  // /storage/... → <cwd>/storage/...
  const rel = clean.replace(/^\/storage\//, "");
  const abs = path.join(process.cwd(), "storage", rel);
  return fs.existsSync(abs) ? abs : null;
}

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

  // ── Resolve logo absolute path ──────────────────────────────────────────────
  const logoAbsPath = storageUrlToAbs(s?.logoPath);

  // ── Resolve all item image absolute paths ───────────────────────────────────
  const imageAbsPaths: Record<string, string> = {};
  for (const section of quote.sections) {
    for (const item of section.items) {
      for (const img of item.images) {
        const abs = storageUrlToAbs(img.path);
        if (abs) imageAbsPaths[img.id] = abs;
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ClassicTemplate as any, {
    quote,
    settings: s,
    logoAbsPath,
    imageAbsPaths,
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
