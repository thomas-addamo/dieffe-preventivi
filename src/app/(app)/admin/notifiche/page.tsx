import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { ComposeNotificationClient } from "./ComposeNotificationClient";

export default async function AdminNotificationsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const recipients = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.disabled, false))
    .orderBy(asc(users.name));

  return <ComposeNotificationClient recipients={recipients} />;
}
