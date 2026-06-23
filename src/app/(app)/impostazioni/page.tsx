import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { ImpostazioniClient } from "./ImpostazioniClient";

export default async function ImpostazioniPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  // Le impostazioni sono accessibili a TUTTI: gli utenti gestiscono le proprie
  // preferenze personali; solo l'admin vede e modifica le impostazioni aziendali.
  const isAdmin = session.user.role === "admin";
  const [settings] = isAdmin
    ? await db.select().from(companySettings).limit(1)
    : [null];

  return (
    <ImpostazioniClient
      initialSettings={settings ?? null}
      isAdmin={isAdmin}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
