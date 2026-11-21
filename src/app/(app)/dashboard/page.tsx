import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { sitesEnabledFor } from "@/lib/features";
import { DashboardClient } from "./DashboardClient";

// Dashboard (C1): cosa fare adesso, i numeri del mese, i cantieri in corso.
// L'elenco dei preventivi è nella pagina Preventivi.
export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const data = await getDashboardData({
    isAdmin: session.user.role === "admin",
    showSites: sitesEnabledFor(session.user.role),
  });

  return (
    <DashboardClient
      data={data}
      currentUser={{ id: session.user.id, name: session.user.name }}
      canCreate={session.user.role !== "viewer"}
    />
  );
}
