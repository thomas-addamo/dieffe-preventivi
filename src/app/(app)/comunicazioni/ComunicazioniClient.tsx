"use client";

import { useMenuParam } from "@/hooks/use-menu-param";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Archive,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Page, PageHeader, EmptyState } from "@/components/shared/Page";
import { PdfExportSheet, prefersPdfSheet } from "@/components/shared/PdfExportSheet";
import { usePermissions } from "@/hooks/use-permissions";
import { cn, formatDate } from "@/lib/utils";
import type { Communication, CommunicationRecipient } from "@/lib/db/schema";
import {
  EMPTY_DOC,
  RECIPIENT_KINDS,
  docToPlain,
  isDocEmpty,
  recipientKindLabel,
  type CommunicationInput,
  type PMNode,
} from "@/lib/communications";

// L'editor (Tiptap) vive solo nel browser.
const LetterEditor = dynamic(
  () => import("@/components/communications/LetterEditor").then((m) => m.LetterEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[480px] items-center justify-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    ),
  }
);

type ClientOption = { id: string; name: string; address: string | null; email: string | null };
type Company = {
  name: string;
  address: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
};

type Draft = CommunicationInput & { recipients: CommunicationRecipient[] };

const today = () => new Date().toISOString().slice(0, 10);

function emptyDraft(): Draft {
  return {
    subject: "",
    body: EMPTY_DOC,
    recipients: [],
    place: "",
    documentDate: today(),
    includeStamp: true,
    signatory: "",
  };
}

function toDraft(c: Communication): Draft {
  return {
    subject: c.subject,
    body: c.body as PMNode,
    recipients: c.recipients ?? [],
    place: c.place ?? "",
    documentDate: c.documentDate ?? today(),
    includeStamp: c.includeStamp,
    signatory: c.signatory ?? "",
  };
}

export function ComunicazioniClient({
  initialItems,
  clients,
  company,
  dbReady,
}: {
  initialItems: Communication[];
  clients: ClientOption[];
  company: Company;
  dbReady: boolean;
}) {
  const { can: perms } = usePermissions();
  const readOnly = !perms.manageCommunications;

  const [items, setItems] = useState(initialItems);
  const [current, setCurrent] = useState<Communication | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saved, setSaved] = useState<string>(() => JSON.stringify(emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pdfSheetUrl, setPdfSheetUrl] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== saved;
  const canSave = dbReady && !readOnly && (!!draft.subject.trim() || !isDocEmpty(draft.body));

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function confirmDiscard() {
    return !dirty || confirm("Ci sono modifiche non salvate. Continuare senza salvarle?");
  }

  useMenuParam("nuova", () => startNew());

  function startNew() {
    if (!confirmDiscard()) return;
    const d = emptyDraft();
    setCurrent(null);
    setDraft(d);
    setSaved(JSON.stringify(d));
  }

  function open(c: Communication) {
    if (!confirmDiscard()) return;
    const d = toDraft(c);
    setCurrent(c);
    setDraft(d);
    setSaved(JSON.stringify(d));
    setArchiveOpen(false);
  }

  function duplicate(c: Communication) {
    if (!confirmDiscard()) return;
    const d = { ...toDraft(c), documentDate: today() };
    setCurrent(null);
    setDraft(d);
    setSaved("");
    setArchiveOpen(false);
    toast.success("Copia pronta: modifica e salva");
  }

  async function save(): Promise<Communication | null> {
    if (!canSave) return current;
    setSaving(true);
    try {
      const res = await fetch(current ? `/api/communications/${current.id}` : "/api/communications", {
        method: current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const row = (await res.json()) as Communication;
      setCurrent(row);
      setSaved(JSON.stringify(draft));
      setItems((prev) => [row, ...prev.filter((x) => x.id !== row.id)]);
      return row;
    } catch {
      toast.error("Salvataggio non riuscito");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const row = await save();
    if (row) toast.success(`Comunicazione ${row.code} salvata`);
  }

  /** Il PDF si genera dalla versione salvata: se serve, salva prima. */
  async function exportPdf(mode: "preview" | "download") {
    let row = current;
    if (!row || dirty) row = await save();
    if (!row) return;
    const url = `/api/communications/${row.id}/pdf`;
    if (prefersPdfSheet()) {
      setPdfSheetUrl(url);
      return;
    }
    if (mode === "preview") {
      window.open(url, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = `${url}?download=1`;
      a.download = "";
      a.click();
    }
  }

  async function remove(c: Communication) {
    if (!confirm(`Eliminare la comunicazione ${c.code}?`)) return;
    const res = await fetch(`/api/communications/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Eliminazione non riuscita");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== c.id));
    if (current?.id === c.id) {
      const d = emptyDraft();
      setCurrent(null);
      setDraft(d);
      setSaved(JSON.stringify(d));
    }
    toast.success("Comunicazione eliminata");
  }

  // ── Destinatari ──
  function addRecipient(kind: string) {
    const k = RECIPIENT_KINDS.find((x) => x.value === kind) ?? RECIPIENT_KINDS[0];
    patch({
      recipients: [
        ...draft.recipients,
        { kind: k.value, salutation: k.salutation, name: "", address: "", email: "", clientId: null },
      ],
    });
  }
  function updateRecipient(i: number, p: Partial<CommunicationRecipient>) {
    patch({ recipients: draft.recipients.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  }
  function removeRecipient(i: number) {
    patch({ recipients: draft.recipients.filter((_, j) => j !== i) });
  }

  const status = !current
    ? "Nuova comunicazione"
    : dirty
      ? `${current.code} · modifiche non salvate`
      : `${current.code} · salvata`;

  return (
    <Page>
      <PageHeader
        title="Crea comunicazione"
        subtitle="Lettere e comunicazioni su carta intestata, con timbro Dieffe."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Archivio</span>
              {items.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              )}
            </Button>
            {!readOnly && (
              <Button className="gap-2" onClick={startNew}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuova</span>
              </Button>
            )}
          </>
        }
      />

      {!dbReady && (
        <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          L&apos;archivio delle comunicazioni non è ancora attivo: va applicata la migrazione del
          database (<code className="font-mono text-xs">pnpm db:migrate</code>).
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ── Colonna principale ── */}
        <div className="min-w-0 space-y-4">
          {/* Destinatari */}
          <section className="surface space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="px-1 text-[15px] font-semibold">Destinatari</h2>
              {!readOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <UserPlus className="h-4 w-4" /> Aggiungi
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {RECIPIENT_KINDS.map((k) => (
                      <DropdownMenuItem key={k.value} onClick={() => addRecipient(k.value)}>
                        {k.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {draft.recipients.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                Nessun destinatario. Aggiungi il cliente, i condòmini, l&apos;architetto o chi preferisci.
              </p>
            ) : (
              <div className="space-y-2.5">
                {draft.recipients.map((r, i) => (
                  <RecipientCard
                    key={i}
                    value={r}
                    clients={clients}
                    readOnly={readOnly}
                    onChange={(p) => updateRecipient(i, p)}
                    onRemove={() => removeRecipient(i)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Oggetto */}
          <section className="surface space-y-1.5">
            <Label htmlFor="com-subject">
              Oggetto
            </Label>
            <Input
              id="com-subject"
              value={draft.subject}
              onChange={(e) => patch({ subject: e.target.value })}
              readOnly={readOnly}
              placeholder="Es: Avviso inizio lavori in facciata"
              className="font-medium"
            />
          </section>

          {/* Corpo */}
          <section className="surface overflow-hidden p-0">
            <LetterEditor value={draft.body} onChange={(body) => patch({ body })} readOnly={readOnly} />
          </section>
        </div>

        {/* ── Colonna documento ── */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="surface space-y-4">
            <div className="px-1">
              <h2 className="text-[15px] font-semibold">Documento</h2>
              <p className={cn("mt-0.5 text-xs", dirty && current ? "text-amber-600" : "text-muted-foreground")}>
                {status}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="com-place">Luogo</Label>
                <Input
                  id="com-place"
                  value={draft.place ?? ""}
                  onChange={(e) => patch({ place: e.target.value })}
                  readOnly={readOnly}
                  placeholder="Es: Torino"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="com-date">Data</Label>
                <Input
                  id="com-date"
                  type="date"
                  value={draft.documentDate ?? ""}
                  onChange={(e) => patch({ documentDate: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="com-signatory">Firmatario (opzionale)</Label>
              <Input
                id="com-signatory"
                value={draft.signatory ?? ""}
                onChange={(e) => patch({ signatory: e.target.value })}
                readOnly={readOnly}
                placeholder="Es: Il titolare"
              />
            </div>

            {/* Timbro */}
            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">Timbro Dieffe</span>
                  <span className="block text-xs text-muted-foreground">
                    Ragione sociale, indirizzo, P.IVA e contatti
                  </span>
                </span>
                <Switch
                  checked={draft.includeStamp}
                  onCheckedChange={(v) => patch({ includeStamp: v })}
                  disabled={readOnly}
                />
              </label>
              {draft.includeStamp && <StampPreview company={company} />}
            </div>

            <div className="space-y-2">
              {!readOnly && (
                <Button className="w-full gap-2" onClick={handleSave} disabled={!canSave || saving || (!dirty && !!current)}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {current && !dirty ? "Salvata" : "Salva"}
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => exportPdf("preview")}
                  disabled={saving || (!current && !canSave)}
                >
                  <Eye className="h-4 w-4" /> Anteprima
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => exportPdf("download")}
                  disabled={saving || (!current && !canSave)}
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* ── Archivio ── */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Archivio comunicazioni</DialogTitle>
            <DialogDescription>
              {items.length} comunicazion{items.length === 1 ? "e" : "i"} salvat{items.length === 1 ? "a" : "e"}
            </DialogDescription>
          </DialogHeader>
          {items.length === 0 ? (
            <EmptyState icon={Mail} title="Nessuna comunicazione salvata" className="py-8" />
          ) : (
            <div className="divide-y overflow-hidden rounded-lg border">
              {items.map((c) => (
                <ArchiveRow
                  key={c.id}
                  item={c}
                  active={current?.id === c.id}
                  readOnly={readOnly}
                  onOpen={() => open(c)}
                  onDuplicate={() => duplicate(c)}
                  onDelete={() => remove(c)}
                  onPdf={() => {
                    const url = `/api/communications/${c.id}/pdf`;
                    if (prefersPdfSheet()) setPdfSheetUrl(url);
                    else window.open(url, "_blank");
                  }}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {pdfSheetUrl && (
        <PdfExportSheet
          url={pdfSheetUrl}
          title={draft.subject || current?.code || "Comunicazione"}
          onClose={() => setPdfSheetUrl(null)}
        />
      )}
    </Page>
  );
}

// ─── Sotto-componenti ────────────────────────────────────────────────────────

function RecipientCard({
  value: r,
  clients,
  readOnly,
  onChange,
  onRemove,
}: {
  value: CommunicationRecipient;
  clients: ClientOption[];
  readOnly: boolean;
  onChange: (p: Partial<CommunicationRecipient>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Select
          value={r.kind}
          onValueChange={(kind) => {
            const k = RECIPIENT_KINDS.find((x) => x.value === kind);
            // La formula cambia con il tipo solo se non è stata personalizzata.
            const wasDefault = RECIPIENT_KINDS.some((x) => x.salutation === r.salutation);
            onChange({ kind, ...(k && wasDefault ? { salutation: k.salutation } : {}) });
          }}
          disabled={readOnly}
        >
          <SelectTrigger className="h-9 w-auto min-w-36 md:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECIPIENT_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {r.kind === "cliente" && clients.length > 0 && !readOnly && (
          <Select
            value={r.clientId ?? ""}
            onValueChange={(id) => {
              const c = clients.find((x) => x.id === id);
              if (c) onChange({ clientId: c.id, name: c.name, address: c.address ?? "", email: c.email ?? "" });
            }}
          >
            <SelectTrigger className="h-9 min-w-0 flex-1 md:h-9">
              <SelectValue placeholder="Scegli dall'anagrafica…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Rimuovi destinatario"
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Input
          aria-label="Formula di apertura"
          value={r.salutation}
          onChange={(e) => onChange({ salutation: e.target.value })}
          readOnly={readOnly}
          placeholder="Spett.le"
        />
        <Input
          aria-label="Nome destinatario"
          value={r.name}
          onChange={(e) => onChange({ name: e.target.value })}
          readOnly={readOnly}
          placeholder={
            r.kind === "condomini"
              ? "Condominio Via Roma 12"
              : r.kind === "architetto"
                ? "Mario Bianchi"
                : `Nome ${recipientKindLabel(r.kind).toLowerCase()}`
          }
          className="font-medium"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Textarea
          aria-label="Indirizzo"
          value={r.address ?? ""}
          onChange={(e) => onChange({ address: e.target.value })}
          readOnly={readOnly}
          rows={2}
          placeholder="Indirizzo (anche su più righe)"
          className="min-h-0 resize-none"
        />
        <Input
          aria-label="Email"
          type="email"
          value={r.email ?? ""}
          onChange={(e) => onChange({ email: e.target.value })}
          readOnly={readOnly}
          placeholder="Email (opzionale)"
        />
      </div>
    </div>
  );
}

/** Anteprima del timbro come apparirà nel PDF. */
function StampPreview({ company }: { company: Company }) {
  const contacts = [company.phone ? `Tel. ${company.phone}` : null, company.email].filter(Boolean).join(" · ");
  return (
    <div className="flex justify-center rounded-lg bg-white px-3 py-4">
      <div className="rounded-md border-[1.5px] border-blue-900 p-[2px] opacity-90">
        <div className="rounded-[4px] border-[0.5px] border-blue-900 px-3 py-1.5 text-center text-blue-900">
          <p className="text-[11px] font-bold uppercase tracking-wide">{company.name}</p>
          {company.address && <p className="text-[8px] leading-tight">{company.address}</p>}
          {company.vatNumber && <p className="text-[8px] font-bold leading-tight">P.IVA {company.vatNumber}</p>}
          {contacts && <p className="text-[8px] leading-tight">{contacts}</p>}
        </div>
      </div>
    </div>
  );
}

function ArchiveRow({
  item: c,
  active,
  readOnly,
  onOpen,
  onDuplicate,
  onDelete,
  onPdf,
}: {
  item: Communication;
  active: boolean;
  readOnly: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPdf: () => void;
}) {
  const recipients = (c.recipients ?? []).map((r) => r.name).filter(Boolean).join(", ");
  const preview = useMemo(() => docToPlain(c.body as PMNode).slice(0, 120), [c.body]);
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", active && "bg-primary/[0.05]")}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{c.subject || "Senza oggetto"}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {c.code} · {formatDate(c.createdAt)}
            {recipients ? ` · ${recipients}` : preview ? ` · ${preview}` : ""}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Apri PDF" onClick={onPdf}>
          <Download className="h-4 w-4" />
        </Button>
        {!readOnly && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Duplica" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Elimina"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
