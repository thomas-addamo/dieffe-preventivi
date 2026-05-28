import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { lt, isNotNull, and, eq } from "drizzle-orm";
import { deleteCloudinaryFolder } from "@/lib/cloudinary";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const expiredQuotes = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(
      and(
        isNotNull(quotes.deletedAt),
        lt(quotes.deletedAt, thirtyDaysAgo)
      )
    );

  for (const quote of expiredQuotes) {
    await deleteCloudinaryFolder(`dieffe-preventivi/${quote.id}`).catch(() => {});
    await db.delete(quotes).where(eq(quotes.id, quote.id));
  }

  return NextResponse.json({ deleted: expiredQuotes.length });
}
