import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSiteDetail } from "@/lib/sites/queries";
import { needsInsights } from "@/lib/sites/insights";
import { can } from "@/lib/permissions/check";
import type { UserRole } from "@/lib/permissions/types";
import { CantiereClient } from "./CantiereClient";
import type { SiteData } from "./site-api";
import { sitesEnabledFor } from "@/lib/features";
import { SitesMaintenance } from "@/components/sites/SitesMaintenance";

export default async function CantierePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!sitesEnabledFor(session.user.role)) return <SitesMaintenance />;

  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const detail = await getSiteDetail(id);
  // Cantiere eliminato o mai esistito.
  if (!detail) notFound();

  const initial = JSON.parse(JSON.stringify({ ...detail, insightsStale: needsInsights(detail) })) as SiteData;
  return (
    <CantiereClient
      initial={initial}
      initialTab={tab}
      canManage={can.manageSites(session.user.role as UserRole)}
      userName={session.user.name}
      userId={session.user.id}
      isAdmin={session.user.role === "admin"}
    />
  );
}
