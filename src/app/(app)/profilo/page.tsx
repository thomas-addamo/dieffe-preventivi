import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { ProfiloClient } from "./ProfiloClient";

export default async function ProfiloPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const [settings] = await db.select().from(companySettings).limit(1);

  return (
    <ProfiloClient
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
      companyName={settings?.companyName ?? null}
    />
  );
}
