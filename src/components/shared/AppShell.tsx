"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { UserRoleProvider } from "./UserRoleContext";
import type { UserRole } from "@/lib/permissions/types";
import { useRouter } from "next/navigation";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UserRoleProvider role={userRole as UserRole}>
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:block">
        <Sidebar userRole={userRole} trashCount={trashCount} />
      </div>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 shadow-xl overflow-hidden rounded-r-2xl">
            <Sidebar userRole={userRole} trashCount={trashCount} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          userName={userName}
          userEmail={userEmail}
          onMenuClick={() => setSidebarOpen(true)}
        />
        {isImpersonated && <ImpersonationBanner userName={userName} userRole={userRole} />}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
    </UserRoleProvider>
  );
}
