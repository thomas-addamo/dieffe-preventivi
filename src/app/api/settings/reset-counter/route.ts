import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quoteYearCounters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const year = new Date().getFullYear();
  await db.update(quoteYearCounters).set({ counter: 0 }).where(eq(quoteYearCounters.year, year));

  return NextResponse.json({ ok: true });
}
