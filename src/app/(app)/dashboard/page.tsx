import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { quotes, clients, users } from "@/lib/db/schema";
import { eq, desc, count, sum, and, gte, lte } from "drizzle-orm";
import { DashboardClient } from "./DashboardClient";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const [totalCount] = await db.select({ value: count() }).from(quotes);

  const allQuotes = await db
    .select({
      id: quotes.id,
      code: quotes.code,
      title: quotes.title,
      status: quotes.status,
      vatRate: quotes.vatRate,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      clientName: clients.name,
      authorName: users.name,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .innerJoin(users, eq(quotes.userId, users.id))
    .orderBy(desc(quotes.createdAt));

  const acceptedThisMonth = allQuotes.filter(
    (q) =>
      q.status === "accepted" &&
      q.updatedAt >= monthStart &&
      q.updatedAt <= monthEnd + "T23:59:59"
  ).length;

  const pendingCount = allQuotes.filter(
    (q) => q.status === "sent"
  ).length;

  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .orderBy(clients.name);

  return (
    <DashboardClient
      initialQuotes={allQuotes}
      clients={allClients}
      stats={{
        total: totalCount.value,
        acceptedThisMonth,
        pending: pendingCount,
      }}
    />
  );
}
