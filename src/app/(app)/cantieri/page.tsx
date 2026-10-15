import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { syncSites } from "@/lib/sites/sync";
import { getSitesOverview } from "@/lib/sites/queries";
import { CantieriClient } from "./CantieriClient";
import { FEATURES } from "@/lib/features";
import { SitesMaintenance } from "@/components/sites/SitesMaintenance";

export const metadata = { title: "Gestione Cantieri" };

export default async function CantieriPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!FEATURES.sites) return <SitesMaintenance />;

  await syncSites();
  const overview = await getSitesOverview();
  return <CantieriClient initial={overview} />;
}
