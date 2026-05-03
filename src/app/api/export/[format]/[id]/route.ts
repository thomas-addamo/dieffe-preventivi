import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { exportToExcel } from "@/lib/exporters/excel";
import { exportToCsv } from "@/lib/exporters/csv";
import { exportToJson } from "@/lib/exporters/json";
import { generateExportFilename, slugify } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ format: string; id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { format, id } = await params;
  const quote = await getQuoteWithRelations(id);
  if (!quote) return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });

  const [settings] = await db.select().from(companySettings).limit(1);

  switch (format) {
    case "excel": {
      const buf = await exportToExcel(quote, settings ?? null);
      const filename = generateExportFilename(quote.code, quote.title, "xlsx");
      return new NextResponse(buf as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    case "csv": {
      const csv = exportToCsv(quote);
      const filename = generateExportFilename(quote.code, quote.title, "csv");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    case "json": {
      const json = await exportToJson(quote);
      const filename = generateExportFilename(quote.code, quote.title, "json");
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    default:
      return NextResponse.json({ error: "Formato non supportato" }, { status: 400 });
  }
}
