import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { communications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateExportFilename } from "@/lib/utils";
import { generateCommunicationPdfBuffer } from "@/lib/exporters/communication-pdf";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const [row] = await db.select().from(communications).where(eq(communications.id, id));
  if (!row) return NextResponse.json({ error: "Comunicazione non trovata" }, { status: 404 });

  const buffer = await generateCommunicationPdfBuffer(row);
  const filename = generateExportFilename(row.code, row.subject || "comunicazione", "pdf");
  const disposition = new URL(req.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  });
}
