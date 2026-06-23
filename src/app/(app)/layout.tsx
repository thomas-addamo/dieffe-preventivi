import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/shared/AppShell";
import { QueryProvider } from "@/components/shared/QueryProvider";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { UpdateBanner } from "@/components/shared/update-banner";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { isNotNull, count } from "drizzle-orm";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const { user } = session;

  let trashCount = 0;
  if (user.role === "admin" || user.role === "editor") {
    const [row] = await db.select({ value: count() }).from(quotes).where(isNotNull(quotes.deletedAt));
    trashCount = row?.value ?? 0;
  }

  return (
    <QueryProvider>
      {/* Solo in Electron mostrano contenuto; in web/Vercel restano invisibili */}
      <OfflineBanner />
      <UpdateBanner />
      <AppShell
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
        trashCount={trashCount}
        isImpersonated={session.session.isImpersonated}
      >
        {children}
      </AppShell>
    </QueryProvider>
  );
}
