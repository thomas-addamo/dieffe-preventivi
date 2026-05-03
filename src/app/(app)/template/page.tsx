import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { quoteTemplates } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { TemplateClient } from "./TemplateClient";

export default async function TemplatePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const rows = await db
    .select()
    .from(quoteTemplates)
    .orderBy(desc(quoteTemplates.createdAt));

  return <TemplateClient initialTemplates={rows} />;
}
