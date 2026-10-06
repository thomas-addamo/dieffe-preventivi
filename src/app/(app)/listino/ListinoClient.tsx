"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { AiSearchPanel } from "./AiSearchPanel";
import { MaintenancePanel } from "./MaintenancePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Page, PageHeader, EmptyState } from "@/components/shared/Page";
import { cn, formatCurrency } from "@/lib/utils";
import { CATALOG, DEFAULT_CATEGORY, categoryPrefix } from "@/lib/price-list/taxonomy";
import type { PriceListItem } from "@/lib/db/schema";

// Listino come CATALOGO: Categoria › Sottocategoria › Voce, nell'ordine di un
// computo metrico. Codici gerarchici assegnati automaticamente (PAV.02.05),
// uso reale nei preventivi in evidenza, voci fissate protette dal riordino.

const UNIT_OF_MEASURES = ["mq", "ml", "mc", "kg", "n°", "h", "a corpo", "vs.carico"];

/** La voce come arriva in JSON (date serializzate). */
type Item = Omit<PriceListItem, "lastUsedAt" | "createdAt" | "updatedAt"> & {
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type StatusFilter = "active" | "all" | "inactive" | "pinned" | "unused";

const STATUS_LABELS: Record<StatusFilter, string> = {
  active: "Solo attive",
  all: "Tutte",
  inactive: "Disattivate",
  pinned: "Fissate",
  unused: "Mai usate",
};

const emptyForm = {
  description: "",
  unitOfMeasure: "mq",
  unitPrice: "",
  category: DEFAULT_CATEGORY,
  subcategory: "",
  notes: "",
  isActive: true,
  pinned: false,
};

function usageLabel(item: Item): string {
  if (!item.lastUsedAt) return "Mai usata";
  const ago = formatDistanceToNow(new Date(item.lastUsedAt), { addSuffix: true, locale: itLocale });
  return item.usageCount > 0
    ? `${item.usageCount} preventiv${item.usageCount === 1 ? "o" : "i"} · ${ago}`
    : `Usata ${ago}`;
}

export function ListinoClient({ userRole }: { userRole: string }) {
  const isAdmin = userRole === "admin";

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ count: number; preview: PriceListItem[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/price-list");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    // Caricamento iniziale: i filtri lavorano in locale sull'intero catalogo.
    let alive = true;
    fetch("/api/price-list")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Item[]) => {
        if (!alive) return;
        setItems(rows);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // ── Filtri (in locale: istantanei) ──
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (filterCategory && i.category !== filterCategory) return false;
      if (status === "active" && !i.isActive) return false;
      if (status === "inactive" && i.isActive) return false;
      if (status === "pinned" && !i.pinned) return false;
      if (status === "unused" && i.lastUsedAt) return false;
      if (!needle) return true;
      return (
        i.description.toLowerCase().includes(needle) ||
        (i.code ?? "").toLowerCase().includes(needle) ||
        (i.subcategory ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, q, filterCategory, status]);

  // ── Gerarchia: categoria › sottocategoria (l'API restituisce già l'ordine del catalogo) ──
  const tree = useMemo(() => {
    const cats = new Map<string, Map<string, Item[]>>();
    for (const it of visible) {
      const cat = it.category ?? DEFAULT_CATEGORY;
      const subs = cats.get(cat) ?? new Map<string, Item[]>();
      cats.set(cat, subs);
      const sub = it.subcategory ?? "";
      subs.set(sub, [...(subs.get(sub) ?? []), it]);
    }
    return CATALOG.filter((c) => cats.has(c.name)).map((c) => ({
      name: c.name,
      prefix: c.prefix,
      subs: [...cats.get(c.name)!.entries()]
        .sort(([a], [b]) => (a || "￿").localeCompare(b || "￿", "it"))
        .map(([name, list]) => ({ name, items: list })),
      count: [...cats.get(c.name)!.values()].reduce((n, l) => n + l.length, 0),
    }));
  }, [visible]);

  const subcategoriesFor = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const i of items) {
      if (!i.category || !i.subcategory) continue;
      const list = (map[i.category] ??= []);
      if (!list.includes(i.subcategory)) list.push(i.subcategory);
    }
    return map;
  }, [items]);

  function toggleCollapsed(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function openCreate() {
    setEditingItem(null);
    setForm({ ...emptyForm, category: filterCategory || DEFAULT_CATEGORY });
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setForm({
      description: item.description,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: item.unitPrice,
      category: item.category ?? DEFAULT_CATEGORY,
      subcategory: item.subcategory ?? "",
      notes: item.notes ?? "",
      isActive: item.isActive,
      pinned: item.pinned,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.description.trim() || !form.unitPrice) {
      toast.error("Descrizione e prezzo sono obbligatori");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      subcategory: form.subcategory.trim() || null,
      notes: form.notes.trim() || null,
    };
    const res = await fetch(editingItem ? `/api/price-list/${editingItem.id}` : "/api/price-list", {
      method: editingItem ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(editingItem ? "Voce aggiornata" : "Voce aggiunta al catalogo");
      setShowModal(false);
      void fetchItems();
    } else {
      toast.error("Errore durante il salvataggio");
    }
  }

  async function patchItem(item: Item, patch: Partial<Pick<Item, "isActive" | "pinned">>) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    const res = await fetch(`/api/price-list/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error("Modifica non riuscita");
      void fetchItems();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/price-list/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success("Voce eliminata");
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      toast.error("Errore durante l'eliminazione");
    }
  }

  async function handleImportPreview() {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", importFile);
    const res = await fetch("/api/price-list/import", { method: "POST", body: fd });
    setImporting(false);
    if (res.ok) {
      setImportPreview(await res.json());
    } else {
      const j = await res.json();
      toast.error(j.error ?? "Errore parsing file");
    }
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", importFile);
    fd.append("confirm", "true");
    const res = await fetch("/api/price-list/import", { method: "POST", body: fd });
    setImporting(false);
    if (res.ok) {
      const { imported } = await res.json();
      toast.success(`${imported} voci importate e catalogate`);
      closeImport();
      void fetchItems();
    } else {
      toast.error("Errore durante l'importazione");
    }
  }

  function closeImport() {
    setShowImport(false);
    setImportFile(null);
    setImportPreview(null);
  }

  async function handleExport() {
    const res = await fetch("/api/price-list/export");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "listino-prezzi.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeCount = items.filter((i) => i.isActive).length;
  const categoryCount = new Set(items.map((i) => i.category)).size;

  return (
    <Page>
      <PageHeader
        title="Listino prezzi"
        subtitle={`${activeCount} voci attive in ${categoryCount} categori${categoryCount === 1 ? "a" : "e"}`}
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importa</span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Esporta</span>
            </Button>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Aggiungi voce</span>
            </Button>
          </>
        }
      />

      <MaintenancePanel isAdmin={isAdmin} onDone={fetchItems} />

      <AiSearchPanel />

      {/* Filtri */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per descrizione, codice o sottocategoria..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select value={filterCategory || "_all"} onValueChange={(v) => setFilterCategory(v === "_all" ? "" : v)}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Tutte le categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tutte le categorie</SelectItem>
              {CATALOG.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {STATUS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Catalogo */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tree.length === 0 ? (
        <div className="surface p-0">
          <EmptyState
            icon={List}
            title={items.length ? "Nessuna voce corrisponde ai filtri" : "Il listino è vuoto"}
            action={
              !items.length && (
                <Button size="sm" className="mt-1" onClick={openCreate}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Aggiungi la prima voce
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {tree.map((cat) => {
            const isCollapsed = collapsed.has(cat.name);
            return (
              <section key={cat.name}>
                <button
                  type="button"
                  onClick={() => toggleCollapsed(cat.name)}
                  aria-expanded={!isCollapsed}
                  className="mb-2 flex w-full items-center gap-2 px-1 text-left"
                >
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                    {cat.prefix}
                  </span>
                  <span className="text-[15px] font-semibold">{cat.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{cat.count}</span>
                  <ChevronDown
                    className={cn(
                      "ml-auto h-4 w-4 text-muted-foreground transition-transform",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div className="surface overflow-hidden p-0">
                    {cat.subs.map((sub, si) => (
                      <div key={sub.name || "_"} className={cn(si > 0 && "border-t")}>
                        {(sub.name || cat.subs.length > 1) && (
                          <div className="border-b bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {sub.name || "Altre voci"}
                          </div>
                        )}
                        <div className="divide-y">
                          {sub.items.map((item) => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              isAdmin={isAdmin}
                              onEdit={() => openEdit(item)}
                              onToggleActive={() => patchItem(item, { isActive: !item.isActive })}
                              onTogglePin={() => patchItem(item, { pinned: !item.pinned })}
                              onDelete={() => setDeleteTarget(item)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Nuova / modifica voce */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifica voce" : "Nuova voce di listino"}</DialogTitle>
            {editingItem?.code && (
              <DialogDescription>
                Codice <span className="font-mono">{editingItem.code}</span> · assegnato dal catalogo
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pl-desc">Descrizione *</Label>
              <textarea
                id="pl-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Es: Posa gres porcellanato 60x60"
                rows={2}
                className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-base shadow-2xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>U.M. *</Label>
                <Select value={form.unitOfMeasure} onValueChange={(v) => setForm({ ...form, unitOfMeasure: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OF_MEASURES.map((um) => (
                      <SelectItem key={um} value={um}>
                        {um}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-price">Prezzo unitario *</Label>
                <Input
                  id="pl-price"
                  type="number"
                  inputMode="decimal"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOG.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-sub">Sottocategoria</Label>
                <Input
                  id="pl-sub"
                  list="pl-subs"
                  value={form.subcategory}
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                  placeholder="Es: Gres porcellanato"
                />
                <datalist id="pl-subs">
                  {(subcategoriesFor[form.category] ?? []).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-notes">Note interne</Label>
              <Input
                id="pl-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Note..."
              />
            </div>
            <div className="divide-y rounded-lg border">
              <label className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm font-medium">Voce attiva</span>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </label>
              <label className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">Fissa la voce</span>
                  <span className="block text-xs text-muted-foreground">
                    Il riordino automatico non la elimina e non la unisce ad altre
                  </span>
                </span>
                <Switch checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingItem ? "Salva modifiche" : "Aggiungi voce"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conferma eliminazione */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          {deleteTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" /> Elimina voce
                </DialogTitle>
                <DialogDescription>
                  Stai eliminando definitivamente: <strong>{deleteTarget.description}</strong>. Questa
                  operazione non può essere annullata.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Annulla
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Elimina
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Importazione */}
      <Dialog open={showImport} onOpenChange={(o) => !o && closeImport()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importa listino</DialogTitle>
            <DialogDescription>
              Excel (.xlsx) o CSV con colonne <strong>descrizione</strong> e <strong>prezzo</strong>; u.m. e
              categoria facoltative. Le voci vengono catalogate e codificate in automatico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="cursor-pointer rounded-lg border-2 border-dashed p-6 text-center hover:bg-muted/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{importFile ? importFile.name : "Clicca per selezionare il file"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Excel (.xlsx) o CSV</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setImportFile(f);
                    setImportPreview(null);
                  }
                  e.target.value = "";
                }}
              />
            </div>

            {importFile && !importPreview && (
              <Button onClick={handleImportPreview} disabled={importing} className="w-full">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Analizza file
              </Button>
            )}

            {importPreview && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Trovate {importPreview.count} voci da importare
                </div>
                <div className="max-h-40 divide-y overflow-y-auto rounded-lg border text-xs">
                  {importPreview.preview.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="flex-1 truncate">{r.description}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {r.unitOfMeasure} • €{r.unitPrice}
                      </span>
                    </div>
                  ))}
                  {importPreview.count > 5 && (
                    <div className="px-3 py-2 italic text-muted-foreground">
                      ... e altre {importPreview.count - 5} voci
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImport}>
              Annulla
            </Button>
            {importPreview && (
              <Button onClick={handleImportConfirm} disabled={importing}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importa {importPreview.count} voci
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

// ─── Riga voce ───────────────────────────────────────────────────────────────

function ItemRow({
  item,
  isAdmin,
  onEdit,
  onToggleActive,
  onTogglePin,
  onDelete,
}: {
  item: Item;
  isAdmin: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", !item.isActive && "opacity-55")}>
      <span className="hidden w-[72px] shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
        {item.code ?? `${categoryPrefix(item.category)}.—`}
      </span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{item.description}</span>
          {item.pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-primary" aria-label="Fissata" />}
          {!item.isActive && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              Disattivata
            </span>
          )}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs",
            item.lastUsedAt ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"
          )}
        >
          {item.code && <span className="font-mono sm:hidden">{item.code} · </span>}
          {usageLabel(item)}
          {item.source === "learned" && " · appresa dai preventivi"}
        </span>
      </button>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums">
          {formatCurrency(parseFloat(item.unitPrice))}
        </span>
        <span className="block text-[11px] text-muted-foreground">/{item.unitOfMeasure}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Azioni voce">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil /> Modifica
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTogglePin}>
            {item.pinned ? <PinOff /> : <Pin />} {item.pinned ? "Non fissare" : "Fissa (mai eliminare)"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleActive}>
            <Power /> {item.isActive ? "Disattiva" : "Riattiva"}
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 /> Elimina
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
