"use client";

import Link from "next/link";
import {
  List,
  LayoutTemplate,
  Trash2,
  BellRing,
  ScrollText,
  BarChart2,
  Activity,
  UserCog,
  Settings,
  ChevronRight,
  Shield,
} from "lucide-react";
import { MobilePage } from "@/components/shared/mobile/MobilePage";

type Item = {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
  badge?: number;
};

interface AltroClientProps {
  userRole: string;
  trashCount: number;
}

function Row({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-accent"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.description}
        </span>
      </span>
      {item.badge != null && item.badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card shadow-xs">
      {children}
    </div>
  );
}

export function AltroClient({ userRole, trashCount }: AltroClientProps) {
  const isAdmin = userRole === "admin";
  const isEditor = userRole === "editor";

  const operativita: Item[] = [
    {
      href: "/listino",
      label: "Listino",
      description: "Prezzi e voci ricorrenti",
      icon: List,
      iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      href: "/template",
      label: "Template",
      description: "Modelli di preventivo riutilizzabili",
      icon: LayoutTemplate,
      iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
  ];

  if (isAdmin || isEditor) {
    operativita.push({
      href: "/cestino",
      label: "Cestino",
      description: "Preventivi eliminati di recente",
      icon: Trash2,
      iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      badge: trashCount,
    });
  }

  const amministrazione: Item[] = [
    {
      href: "/admin/notifiche",
      label: "Invia notifica",
      description: "Comunicazioni agli utenti",
      icon: BellRing,
      iconClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    },
    {
      href: "/admin/statistiche",
      label: "Statistiche",
      description: "Andamento preventivi e conversioni",
      icon: BarChart2,
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      href: "/admin/audit-log",
      label: "Audit Log",
      description: "Registro delle azioni",
      icon: ScrollText,
      iconClass: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    },
    {
      href: "/admin/sessioni",
      label: "Sessioni attive",
      description: "Dispositivi connessi",
      icon: Activity,
      iconClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
    {
      href: "/utenti",
      label: "Utenti",
      description: "Gestione account e ruoli",
      icon: UserCog,
      iconClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
    {
      href: "/impostazioni",
      label: "Impostazioni",
      description: "Dati azienda e preferenze",
      icon: Settings,
      iconClass: "bg-gray-500/10 text-gray-600 dark:text-gray-300",
    },
  ];

  return (
    <MobilePage title="Altro" className="mx-auto max-w-md">
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Operatività
      </p>
      <Group>
        {operativita.map((item) => (
          <Row key={item.href} item={item} />
        ))}
      </Group>

      {isAdmin && (
        <>
          <p className="mb-2 flex items-center gap-1 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3 w-3" /> Amministrazione
          </p>
          <Group>
            {amministrazione.map((item) => (
              <Row key={item.href} item={item} />
            ))}
          </Group>
        </>
      )}
    </MobilePage>
  );
}
