"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  Flag,
  Images,
  ListChecks,
  Mail,
  MapPin,
  Navigation,
  NotebookPen,
  Phone,
  Receipt,
  RotateCcw,
  Settings2,
  Trash2,
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
import { PhotosTab } from "./PhotosTab";

// ─────────────────────────────────────────────────────────────────────────────
// Pagina del cantiere: avanzamento (fasi), SAL e fatturazione, calendario con
// analisi del ritardo, diario, foto e consigli IA. "Concludi lavori" mette il
// cantiere in archivio con tutti i suoi dati: si consulta e si può riaprire.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "avanzamento", label: "Avanzamento", icon: ListChecks },
  { id: "sal", label: "SAL e fatture", icon: Receipt },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "note", label: "Note e consigli", icon: NotebookPen },
  { id: "foto", label: "Foto", icon: Images },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function CantiereClient({
  initial,
  initialTab,
  canManage: canManageRole,
  userName,
  userId,
  isAdmin,
}: {
  initial: SiteData;
  initialTab?: string;
  canManage: boolean;
  userName: string;
  userId: string;
  isAdmin: boolean;
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
  // I cantieri in archivio si consultano soltanto (si riaprono dal riquadro in alto).
  const archived = !!s.archivedAt;
  const canManage = canManageRole && !archived;
  const [busy, setBusy] = useState(false);
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
      toast.success("Lavori conclusi: il cantiere è in archivio e si può riaprire quando serve.");
      router.replace("/cantieri");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
      setCompleting(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      await siteRequest("POST", `/api/sites/${id}/reopen`);
      await qc.invalidateQueries({ queryKey: siteKey(id) });
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Cantiere riaperto");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (!confirm(`Eliminare DEFINITIVAMENTE il cantiere "${siteTitle(s.name)}"? Fasi, SAL, calendario, diario e foto non si potranno recuperare. I preventivi restano.`)) return;
    setBusy(true);
    try {
      await siteRequest("DELETE", `/api/sites/${id}`);
      qc.removeQueries({ queryKey: siteKey(id) });
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Cantiere eliminato");
      router.replace("/cantieri?filtro=archivio");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
      setBusy(false);
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

      {archived && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-sm sm:flex-row sm:items-center">
          <Archive className="hidden h-5 w-5 shrink-0 text-violet-600 sm:block dark:text-violet-400" />
          <p className="flex-1">
            {s.archiveReason === "completed" ? (
              <>
                <b>Lavori conclusi</b> il {new Date(s.archivedAt!).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}: il cantiere è in archivio e si
                consulta in sola lettura.
              </>
            ) : (
              <>
                <b>In archivio</b> perché il preventivo principale non è più inviato o accettato (bozza, rifiutato o cestinato). Torna in corso da
                solo, con tutti i suoi dati, quando il preventivo torna inviato o accettato.
              </>
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            {canManageRole && s.archiveReason === "completed" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={reopen}>
                <RotateCcw /> Riapri cantiere
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={purge} className="text-red-600 hover:bg-red-500/10 hover:text-red-700">
                <Trash2 /> Elimina definitivamente
              </Button>
            )}
          </div>
        </div>
      )}

      {pending && !archived && (
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
      {tab === "note" && <NotesTab data={data} canManage={canManage} userName={userName} userId={userId} isAdmin={isAdmin} />}
      {tab === "foto" && <PhotosTab data={data} canManage={canManage} userId={userId} isAdmin={isAdmin} />}

      {settings && <SiteSettingsDialog data={data} open={settings} onOpenChange={setSettings} />}

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concludere i lavori?</DialogTitle>
            <DialogDescription>
              Il cantiere va in <b>archivio</b> con fasi, SAL, calendario, diario e foto: si consulta quando serve e si può riaprire. I
              preventivi vengono segnati &quot;lavori conclusi&quot;.
            </DialogDescription>
          </DialogHeader>
          {notInvoiced.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Attenzione: {notInvoiced.length === 1 ? "1 SAL non è" : `${notInvoiced.length} SAL non sono`} ancora fatturati (
              {formatCurrency(notInvoiced.reduce((a, x) => a + x.value, 0))}). In archivio non arrivano più i promemoria.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>
              Non ancora
            </Button>
            <Button disabled={completing} onClick={complete}>
              Concludi e archivia
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
