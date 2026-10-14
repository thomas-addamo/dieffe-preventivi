"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  Flag,
  ListChecks,
  Mail,
  MapPin,
  Navigation,
  NotebookPen,
  Phone,
  Receipt,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Page } from "@/components/shared/Page";
import { cn, formatCurrency } from "@/lib/utils";
import { HealthBadge, ProgressBar, directionsUrl, formatDays, formatShortDate, siteTitle, useAppleDevice } from "@/components/sites/site-ui";
import { siteKey, siteRequest, type SiteData } from "./site-api";
import { PhasesTab } from "./PhasesTab";
import { MilestonesTab } from "./MilestonesTab";
import { CalendarTab } from "./CalendarTab";
import { InsightsCard, NotesTab } from "./NotesTab";
import { SiteSettingsDialog } from "./SiteSettingsDialog";

// ─────────────────────────────────────────────────────────────────────────────
// Pagina del cantiere: avanzamento (fasi), SAL e fatturazione, calendario con
// analisi del ritardo, diario e consigli IA. "Concludi lavori" elimina il
// cantiere e tutti i suoi dati; i preventivi restano.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "avanzamento", label: "Avanzamento", icon: ListChecks },
  { id: "sal", label: "SAL e fatture", icon: Receipt },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "note", label: "Note e consigli", icon: NotebookPen },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function CantiereClient({
  initial,
  initialTab,
  canManage,
  userName,
}: {
  initial: SiteData;
  initialTab?: string;
  canManage: boolean;
  userName: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const id = initial.site.id;
  const { data = initial } = useQuery<SiteData>({
    queryKey: siteKey(id),
    queryFn: async () => {
      const r = await fetch(`/api/sites/${id}`);
      if (r.status === 404) {
        router.replace("/cantieri");
        return initial;
      }
      if (!r.ok) throw new Error("Errore di caricamento");
      return r.json();
    },
    initialData: initial,
    staleTime: 15_000,
    // Finché l'IA prepara fasi e SAL, ricontrolla ogni pochi secondi.
    refetchInterval: (q) => (q.state.data?.setupPending ? 4000 : false),
  });

  const apple = useAppleDevice();
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : "avanzamento");
  const [settings, setSettings] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  const s = data.site;
  const m = data.metrics;
  const pending = s.status === "pending";
  const notInvoiced = data.milestones.filter((x) => !x.invoicedAt);

  function selectTab(t: TabId) {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  }

  async function complete() {
    setCompleting(true);
    try {
      await siteRequest("POST", `/api/sites/${id}/complete`);
      qc.removeQueries({ queryKey: siteKey(id) });
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Lavori conclusi: cantiere chiuso ed eliminato. I preventivi restano disponibili.");
      router.replace("/cantieri");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
      setCompleting(false);
    }
  }

  return (
    <Page>
      <Link href="/cantieri" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Gestione Cantieri
      </Link>

      {/* Intestazione */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">{siteTitle(s.name)}</h1>
            <HealthBadge health={m.health} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {s.address ?? "Indirizzo mancante"}
            </span>
            {data.clientName && <span>{data.clientName}</span>}
            {data.clientPhone && (
              <a href={`tel:${data.clientPhone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="h-3.5 w-3.5" /> {data.clientPhone}
              </a>
            )}
            {data.clientEmail && (
              <a href={`mailto:${data.clientEmail}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.quotes.map((q) => (
              <Link
                key={q.id}
                href={`/preventivi/${q.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors hover:border-primary/40",
                  q.kind === "extra" && "border-amber-500/30 bg-amber-500/5"
                )}
              >
                <span className="font-mono">{q.code}</span>
                <span className="text-muted-foreground">{q.kind === "extra" ? "extra" : q.status === "accepted" ? "accettato" : "inviato"}</span>
                <span className="font-medium tabular-nums">{formatCurrency(q.net)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={directionsUrl(s.lat, s.lng, s.address, apple)} target="_blank" rel="noreferrer">
              <Navigation /> Indicazioni
            </a>
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => setSettings(true)}>
              <Settings2 /> Tempi e costi
            </Button>
          )}
          {canManage && !pending && (
            <Button onClick={() => setCompleteOpen(true)}>
              <Flag /> Concludi lavori
            </Button>
          )}
        </div>
      </div>

      {pending && (
        <div className="mb-4 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Il preventivo è stato <b>inviato</b> ma non ancora accettato: il cantiere è in attesa. Puoi già annotare sopralluoghi ed eventi; fasi e SAL
          arrivano all’accettazione.
        </div>
      )}

      {/* Numeri chiave */}
      {!pending && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="surface col-span-2 lg:col-span-1">
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-muted-foreground">Avanzamento</p>
              <p className="text-2xl font-bold tabular-nums">{Math.round(m.progress)}%</p>
            </div>
            <ProgressBar value={m.progress} expected={m.expectedProgress} health={m.health} className="mt-2" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {m.expectedProgress != null ? `Atteso oggi ${Math.round(m.expectedProgress)}%` : "Imposta l'inizio lavori per il confronto"}
            </p>
          </div>
          <div className="surface">
            <p className="text-xs text-muted-foreground">Imponibile lavori</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(m.contractNet)}</p>
            <p className="text-[11px] text-muted-foreground">{formatCurrency(m.contractGross)} con IVA</p>
          </div>
          <button className="surface text-left transition-colors hover:border-primary/40" onClick={() => selectTab("sal")}>
            <p className="text-xs text-muted-foreground">Da fatturare</p>
            <p className={cn("mt-1 text-lg font-bold tabular-nums", m.toInvoice > 0 && "text-amber-600 dark:text-amber-400")}>
              {formatCurrency(m.toInvoice)}
            </p>
            <p className="text-[11px] text-muted-foreground">Fatturato {formatCurrency(m.invoiced)}</p>
          </button>
          <button className="surface text-left transition-colors hover:border-primary/40" onClick={() => selectTab("calendario")}>
            <p className="text-xs text-muted-foreground">Fine lavori</p>
            <p className={cn("mt-1 text-lg font-bold", m.delayDays > 0 && "text-red-600 dark:text-red-400")}>
              {s.plannedEndDate ? formatShortDate(m.delayDays > 0 ? m.forecastEnd : s.plannedEndDate) : "Da fissare"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {m.delayDays > 0 ? `+${formatDays(m.delayDays)} · costo ${formatCurrency(m.delayCost)}` : s.startDate ? `Inizio ${formatShortDate(s.startDate)}` : "Nessuna data di inizio"}
            </p>
          </button>
        </div>
      )}

      {/* Schede */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const badge = t.id === "sal" && m.toInvoice > 0;
          return (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={cn(
                "relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
              {badge && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </div>

      {tab === "avanzamento" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PhasesTab data={data} canManage={canManage} onAllDone={() => setCompleteOpen(true)} />
          </div>
          <div className="space-y-4">
            {!s.startDate && !pending && canManage && (
              <div className="surface space-y-2">
                <p className="font-semibold">Quando partono i lavori?</p>
                <p className="text-sm text-muted-foreground">
                  Con la data di inizio le fasi si distribuiscono nel calendario e si può misurare il ritardo.
                </p>
                <Button size="sm" onClick={() => setSettings(true)}>
                  Imposta le date
                </Button>
              </div>
            )}
            <InsightsCard data={data} compact />
          </div>
        </div>
      )}
      {tab === "sal" && <MilestonesTab data={data} canManage={canManage} />}
      {tab === "calendario" && <CalendarTab data={data} canManage={canManage} onEditSettings={() => setSettings(true)} />}
      {tab === "note" && <NotesTab data={data} canManage={canManage} userName={userName} />}

      {settings && <SiteSettingsDialog data={data} open={settings} onOpenChange={setSettings} />}

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concludere i lavori?</DialogTitle>
            <DialogDescription>
              Il cantiere verrà chiuso ed <b>eliminato</b> con fasi, SAL, calendario e note, per tenere leggero il database. I preventivi restano
              e non genereranno più un cantiere. Nel registro attività resta un riepilogo.
            </DialogDescription>
          </DialogHeader>
          {notInvoiced.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Attenzione: {notInvoiced.length === 1 ? "1 SAL non è" : `${notInvoiced.length} SAL non sono`} ancora fatturati (
              {formatCurrency(notInvoiced.reduce((a, x) => a + x.value, 0))}). Dopo la chiusura il promemoria sparisce.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>
              Non ancora
            </Button>
            <Button variant="destructive" disabled={completing} onClick={complete}>
              Concludi ed elimina cantiere
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
