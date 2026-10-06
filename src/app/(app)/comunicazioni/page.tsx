import { redirect } from "next/navigation";
import { desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, communications, companySettings, type Communication } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { ComunicazioniClient } from "./ComunicazioniClient";

export default async function ComunicazioniPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const [clientRows, [settings]] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, address: clients.address, email: clients.email })
      .from(clients)
      .orderBy(asc(clients.name)),
    db.select().from(companySettings).limit(1),
  ]);

  // Se la migrazione non è ancora stata applicata la pagina resta usabile e
  // spiega cosa manca, invece di andare in errore.
  let rows: Communication[] = [];
  let dbReady = true;
  try {
    rows = await db.select().from(communications).orderBy(desc(communications.createdAt));
  } catch (err) {
    dbReady = false;
    logger.error({ err }, "Tabella communications non disponibile");
  }

  return (
    <ComunicazioniClient
      initialItems={rows}
      clients={clientRows}
      dbReady={dbReady}
      company={{
        name: settings?.companyName || "Dieffe Ristrutturazioni",
        address: settings?.address ?? null,
        vatNumber: settings?.vatNumber ?? null,
        email: settings?.email ?? null,
        phone: settings?.phone ?? null,
      }}
    />
  );
}
