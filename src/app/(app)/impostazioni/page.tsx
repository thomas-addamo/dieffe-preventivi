import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { ImpostazioniClient } from "./ImpostazioniClient";

export default async function ImpostazioniPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [settings] = await db.select().from(companySettings).limit(1);
  return <ImpostazioniClient initialSettings={settings ?? null} />;
}
