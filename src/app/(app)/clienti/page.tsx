import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ClientiClient } from "./ClientiClient";

export default async function ClientiPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));
  return <ClientiClient initialClients={rows} />;
}
