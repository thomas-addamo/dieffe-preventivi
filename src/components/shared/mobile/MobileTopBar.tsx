"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NotificationBell } from "@/components/shared/NotificationBell";

/** Titolo contestuale derivato dalla rotta corrente */
function titleFor(path: string): string {
  if (path.startsWith("/dashboard")) return "Dieffe";
  if (path.startsWith("/clienti")) return "Clienti";
  if (path.startsWith("/profilo")) return "Profilo";
  if (path.startsWith("/altro")) return "Altro";
  if (path.startsWith("/listino")) return "Listino";
  if (path.startsWith("/template")) return "Template";
  if (path.startsWith("/cestino")) return "Cestino";
  if (path.startsWith("/impostazioni")) return "Impostazioni";
  if (path.startsWith("/utenti")) return "Utenti";
  if (path.startsWith("/admin/notifiche")) return "Invia notifica";
  if (path.startsWith("/admin/audit-log")) return "Audit Log";
  if (path.startsWith("/admin/statistiche")) return "Statistiche";
  if (path.startsWith("/admin/sessioni")) return "Sessioni";
  if (path.startsWith("/admin")) return "Amministrazione";
  return "Dieffe";
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface MobileTopBarProps {
  userName: string;
}

export function MobileTopBar({ userName }: MobileTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname.startsWith("/dashboard");
  const title = titleFor(pathname);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/50 bg-[var(--background)]/80 pt-safe backdrop-blur-xl lg:hidden">
      <div className="flex h-[var(--mobile-topbar-h)] items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {isHome ? (
            <Image
              src="/icona_dieffe.svg"
              alt=""
              width={26}
              height={26}
              className="ml-1 shrink-0"
              priority
            />
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Torna indietro"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-transform active:scale-90"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
            </button>
          )}
          <span className="truncate text-[19px] font-semibold tracking-tight">
            {title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell />
          <Link
            href="/profilo"
            aria-label="Profilo"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary transition-transform active:scale-90"
          >
            {initials(userName) || "U"}
          </Link>
        </div>
      </div>
    </header>
  );
}
