import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  companyName: z.string().optional(),
  address: z.string().nullable().optional(),
  vatNumber: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  defaultVatRate: z.number().optional(),
  defaultExportPath: z.string().nullable().optional(),
  pdfTemplate: z.enum(["classic", "modern", "minimal"]).optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  emailFromAddress: z.string().nullable().optional(),
});

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const [settings] = await db.select().from(companySettings).limit(1);
  return NextResponse.json(settings ?? null);
}

export async function PUT(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const [existing] = await db.select().from(companySettings).limit(1);

  if (existing) {
    await db
      .update(companySettings)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(sql`1 = 1`);
  } else {
    await db.insert(companySettings).values({
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    });
  }

  const [updated] = await db.select().from(companySettings).limit(1);
  return NextResponse.json(updated);
}
