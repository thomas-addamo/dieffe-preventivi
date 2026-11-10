import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queueSiteSyncOnRead } from "@/lib/sites/sync";
import { getSitesOverview } from "@/lib/sites/queries";
import { CantieriClient } from "./CantieriClient";
import { sitesEnabledFor } from "@/lib/features";
import { SitesMaintenance } from "@/components/sites/SitesMaintenance";

export const metadata = { title: "Gestione Cantieri" };

export default async function CantieriPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!sitesEnabledFor(session.user.role)) return <SitesMaintenance />;

  // Risponde subito: allineamento e lavoro in sospeso proseguono dopo.
  const overview = await getSitesOverview();
  queueSiteSyncOnRead(overview.pendingWork);
  return <CantieriClient initial={overview} />;
}
