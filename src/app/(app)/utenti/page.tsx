import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { UtentiClient } from "./UtentiClient";

export default async function UtentiPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return <UtentiClient initialUsers={rows} currentUserId={session.user.id} />;
}
