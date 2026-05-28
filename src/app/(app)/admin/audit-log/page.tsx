import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuditLogClient } from "./AuditLogClient";
import { db } from "@/lib/db/client";
import { auditLog, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function AuditLogPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      changes: auditLog.changes,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(500);

  return <AuditLogClient initialRows={rows} />;
}
