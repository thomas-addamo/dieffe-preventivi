"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileTopBar } from "./mobile/MobileTopBar";
import { MobileTabBar } from "./mobile/MobileTabBar";
import { NotificationToaster } from "./NotificationToaster";
import { PushRegistrar } from "./PushRegistrar";
import { UserRoleProvider } from "./UserRoleContext";
import type { UserRole } from "@/lib/permissions/types";
import { cn } from "@/lib/utils";

function ImpersonationBanner({ userName, userRole }: { userName: string; userRole: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function stopImpersonation() {
    setLoading(true);
    await fetch("/api/admin/stop-impersonate", { method: "POST" });
    router.push("/utenti");
    router.refresh();
  }

  return (
    <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between gap-4 shrink-0">
      <span className="text-sm font-medium">
        👁 Stai visualizzando l&apos;app come <strong>{userName}</strong> ({userRole})
      </span>
      <button
        onClick={stopImpersonation}
        disabled={loading}
        className="text-sm bg-background text-orange-600 font-semibold px-3 py-1 rounded-md hover:bg-muted shrink-0"
      >
        {loading ? "..." : "Torna al tuo account"}
      </button>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  userRole: string;
  userName: string;
  userEmail: string;
  trashCount?: number;
  isImpersonated?: boolean;
}

export function AppShell({ children, userRole, userName, userEmail, trashCount = 0, isImpersonated = false }: AppShellProps) {
  const pathname = usePathname();
  // Le pagine "immersive" (editor preventivo) gestiscono la propria chrome mobile:
  // nascondiamo top bar + tab bar e azzeriamo il padding mobile.
  const immersive = pathname.startsWith("/preventivi/");

  return (
    <UserRoleProvider role={userRole as UserRole}>
      {/* Montati una sola volta: toast in-app + registrazione service worker push */}
      <NotificationToaster />
      <PushRegistrar />
      <div className="lg:flex lg:h-screen lg:overflow-hidden">
        {/* Sidebar desktop — invariata */}
        <div className="hidden lg:block">
          <Sidebar userRole={userRole} trashCount={trashCount} />
        </div>

        {/* Top bar mobile (fissa, frosted) */}
        {!immersive && <MobileTopBar userName={userName} />}

        {/* Colonna contenuto */}
        <div
          className={cn(
            "lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden lg:min-w-0",
            !immersive && "pt-topbar lg:pt-0"
          )}
        >
          {/* Header desktop — invariato (l'hamburger interno è lg:hidden, mai visibile qui) */}
          <div className="hidden lg:block">
            <Header userName={userName} userEmail={userEmail} />
          </div>

          {isImpersonated && <ImpersonationBanner userName={userName} userRole={userRole} />}

          <main
            className={cn(
              "bg-background lg:flex-1 lg:overflow-y-auto",
              !immersive && "pb-tabbar lg:pb-0"
            )}
          >
            {children}
          </main>
        </div>

        {/* Tab bar mobile (fissa, frosted) */}
        {!immersive && <MobileTabBar />}
      </div>
    </UserRoleProvider>
  );
}
