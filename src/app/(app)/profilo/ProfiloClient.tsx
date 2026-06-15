"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sun,
  Moon,
  Monitor,
  KeyRound,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { MobilePage } from "@/components/shared/mobile/MobilePage";
import { useTheme } from "@/components/shared/ThemeProvider";
import { ChangePasswordDialog } from "@/components/shared/ChangePasswordDialog";
import { PushToggle } from "@/components/shared/PushToggle";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Amministratore",
  editor: "Editor",
  viewer: "Visualizzatore",
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface ProfiloClientProps {
  user: { name: string; email: string; role: string };
  companyName: string | null;
}

export function ProfiloClient({ user, companyName }: ProfiloClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showChangePassword, setShowChangePassword] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    toast.success("Disconnesso");
  }

  const themeOptions = [
    { value: "light", label: "Chiaro", icon: Sun },
    { value: "dark", label: "Scuro", icon: Moon },
    { value: "system", label: "Auto", icon: Monitor },
  ] as const;

  return (
    <MobilePage title="Profilo" className="mx-auto max-w-md">
      {/* Card identità */}
      <div className="mb-5 flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-700 text-xl font-bold text-white">
          {initials(user.name) || "U"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <ShieldCheck className="h-3 w-3" />
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>
      </div>

      {/* Aspetto */}
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Aspetto
      </p>
      <div className="mb-5 rounded-2xl border bg-card p-1.5 shadow-xs">
        <div className="grid grid-cols-3 gap-1">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-medium transition-all active:scale-95",
                  active
                    ? "bg-primary/10 text-primary shadow-2xs"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifiche */}
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Notifiche
      </p>
      <div className="mb-5 overflow-hidden rounded-2xl border bg-card shadow-xs">
        <PushToggle />
      </div>

      {/* Account */}
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Account
      </p>
      <div className="mb-5 overflow-hidden rounded-2xl border bg-card shadow-xs">
        <button
          onClick={() => setShowChangePassword(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-accent"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <KeyRound className="h-[18px] w-[18px] text-foreground" />
          </span>
          <span className="flex-1 text-sm font-medium">Cambia password</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Logout */}
      <div className="mb-6 overflow-hidden rounded-2xl border bg-card shadow-xs">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-destructive transition-colors active:bg-destructive/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <LogOut className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1 text-sm font-semibold">Esci</span>
        </button>
      </div>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        {companyName ?? "Dieffe Ristrutturazioni"} · Dieffe Preventivi
      </p>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </MobilePage>
  );
}
