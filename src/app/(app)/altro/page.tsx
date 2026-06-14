import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { isNotNull, count } from "drizzle-orm";
import { AltroClient } from "./AltroClient";

export default async function AltroPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const { user } = session;

  let trashCount = 0;
  if (user.role === "admin" || user.role === "editor") {
    const [row] = await db
      .select({ value: count() })
      .from(quotes)
      .where(isNotNull(quotes.deletedAt));
    trashCount = row?.value ?? 0;
  }

  return <AltroClient userRole={user.role} trashCount={trashCount} />;
}
