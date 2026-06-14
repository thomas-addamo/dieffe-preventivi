"use client";

import { useEffect, useRef, useState } from "react";
import { AiSearchPanel } from "./AiSearchPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Download,
  Upload,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Loader2,
  List,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { PriceListItem } from "@/lib/db/schema";

const UNIT_OF_MEASURES = ["mq", "ml", "mc", "kg", "n°", "h", "a corpo", "vs.carico"];

interface ListinoClientProps {
  userRole: string;
}

const emptyForm = {
  code: "",
  description: "",
  unitOfMeasure: "mq",
  unitPrice: "",
  category: "",
  notes: "",
  isActive: true,
};

export function ListinoClient({ userRole }: ListinoClientProps) {
  const isAdmin = userRole === "admin";

  const [items, setItems] = useState<PriceListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PriceListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ count: number; preview: PriceListItem[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newCategoryInput, setNewCategoryInput] = useState("");

  async function fetchItems() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filterCategory) params.set("category", filterCategory);
    if (filterActive === "active") params.set("isActive", "true");
    if (filterActive === "inactive") params.set("isActive", "false");

    const res = await fetch(`/api/price-list?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  async function fetchCategories() {
    const res = await fetch("/api/price-list/categories");
    if (res.ok) setCategories(await res.json());
  }

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [q, filterCategory, filterActive]);

  function openCreate() {
    setEditingItem(null);
    setForm(emptyForm);
    setNewCategoryInput("");
    setShowModal(true);
  }

  function openEdit(item: PriceListItem) {
    setEditingItem(item);
    setForm({
      code: item.code ?? "",
      description: item.description,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: item.unitPrice,
      category: item.category ?? "",
      notes: item.notes ?? "",
      isActive: item.isActive,
    });
    setNewCategoryInput("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.description || !form.unitPrice) {
      toast.error("Descrizione e prezzo sono obbligatori");
      return;
    }
    setSaving(true);
    const categoryValue = newCategoryInput || form.category || null;
    const payload = {
      ...form,
      code: form.code || null,
      category: categoryValue,
      notes: form.notes || null,
    };

    const url = editingItem ? `/api/price-list/${editingItem.id}` : "/api/price-list";
    const method = editingItem ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (res.ok) {
      toast.success(editingItem ? "Voce aggiornata" : "Voce creata");
      setShowModal(false);
      fetchItems();
      fetchCategories();
    } else {
      toast.error("Errore durante il salvataggio");
    }
  }

  async function toggleActive(item: PriceListItem) {
    const res = await fetch(`/api/price-list/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    if (res.ok) {
      fetchItems();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/price-list/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success("Voce eliminata");
      setDeleteTarget(null);
      fetchItems();
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
      const data = await res.json();
      setImportPreview(data);
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
      toast.success(`${imported} voci importate con successo`);
      setShowImport(false);
      setImportFile(null);
      setImportPreview(null);
      fetchItems();
      fetchCategories();
    } else {
      toast.error("Errore durante l'importazione");
    }
  }

  async function handleExport() {
    const res = await fetch("/api/price-list/export");
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "listino-prezzi.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const allCategories = Array.from(
    new Set([...categories, ...(newCategoryInput ? [newCategoryInput] : [])])
  );

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-xl lg:font-semibold flex items-center gap-2">
            <List className="w-6 h-6 lg:w-5 lg:h-5 text-primary" /> Listino Prezzi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} voci{filterActive === "active" ? " attive" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImport(true)}>
            <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importa</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Esporta</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> Aggiungi voce
          </Button>
        </div>
      </div>

      {/* AI Search */}
      <AiSearchPanel />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cerca nel listino..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterCategory || "_all"} onValueChange={(v) => setFilterCategory(v === "_all" ? "" : v)}>
          <SelectTrigger className="h-9 text-sm w-44">
            <SelectValue placeholder="Tutte le categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tutte le categorie</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={(v) => setFilterActive(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="h-9 text-sm w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Solo attive</SelectItem>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="inactive">Solo disattive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <List className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessuna voce trovata</p>
          <Button size="sm" className="mt-3" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Aggiungi la prima voce
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs w-24">Codice</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Descrizione</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs w-16">U.M.</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs w-28">Prezzo</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs w-36">Categoria</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs w-20">Stato</th>
                  <th className="px-4 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className={`hover:bg-muted/20 ${!item.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{item.code ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{item.description}</div>
                      {item.notes && <div className="text-xs text-muted-foreground mt-0.5">{item.notes}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{item.unitOfMeasure}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatCurrency(parseFloat(item.unitPrice))}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.category ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => toggleActive(item)}>
                        {item.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {items.map((item) => (
              <div key={item.id} className={`border rounded-xl p-3 ${!item.isActive ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-snug">{item.description}</div>
                    {item.category && (
                      <span className="inline-block mt-1 text-xs bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold tabular-nums">{formatCurrency(parseFloat(item.unitPrice))}</div>
                    <div className="text-xs text-muted-foreground">/{item.unitOfMeasure}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <button onClick={() => toggleActive(item)}>
                    {item.isActive ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <ToggleRight className="w-4 h-4" /> Attiva
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ToggleLeft className="w-4 h-4" /> Disattiva
                      </span>
                    )}
                  </button>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">{editingItem ? "Modifica voce" : "Nuova voce listino"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Descrizione *</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Fornitura e posa..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>U.M. *</Label>
                  <Select value={form.unitOfMeasure} onValueChange={(v) => setForm({ ...form, unitOfMeasure: v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OF_MEASURES.map((um) => (
                        <SelectItem key={um} value={um} className="text-sm">{um}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prezzo unitario *</Label>
                  <Input
                    type="number"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.category || "_none"}
                    onValueChange={(v) => {
                      if (v === "_new") {
                        setForm({ ...form, category: "" });
                      } else {
                        setForm({ ...form, category: v === "_none" ? "" : v });
                        setNewCategoryInput("");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm flex-1">
                      <SelectValue placeholder="Seleziona categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nessuna categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      <SelectItem value="_new">+ Nuova categoria...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(form.category === "" && categories.length > 0) || newCategoryInput !== "" ? null : null}
                <Input
                  placeholder="Nuova categoria..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  className="h-9 text-sm mt-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Codice (opzionale)</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="CAP-001"
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note interne</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Note..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="isActive" className="cursor-pointer">Voce attiva</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {editingItem ? "Salva modifiche" : "Crea voce"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Elimina voce</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Stai eliminando definitivamente: <strong>{deleteTarget.description}</strong>. Questa operazione non può essere annullata.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annulla</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Elimina
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">Importa listino</h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowImport(false); setImportFile(null); setImportPreview(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Carica un file Excel (.xlsx) o CSV con colonne: <strong>descrizione</strong>, <strong>prezzo</strong>, u.m. (opzionale), codice (opzionale), categoria (opzionale).
              </p>
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/20"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{importFile ? importFile.name : "Clicca per selezionare il file"}</p>
                <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx) o CSV</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setImportFile(f); setImportPreview(null); }
                    e.target.value = "";
                  }}
                />
              </div>

              {importFile && !importPreview && (
                <Button onClick={handleImportPreview} disabled={importing} className="w-full">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Analizza file
                </Button>
              )}

              {importPreview && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Trovate {importPreview.count} voci da importare
                  </div>
                  <div className="border rounded-lg divide-y text-xs max-h-40 overflow-y-auto">
                    {importPreview.preview.map((r, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className="flex-1 truncate">{r.description}</span>
                        <span className="text-muted-foreground shrink-0">{r.unitOfMeasure} • €{r.unitPrice}</span>
                      </div>
                    ))}
                    {importPreview.count > 5 && (
                      <div className="px-3 py-2 text-muted-foreground italic">
                        ... e altre {importPreview.count - 5} voci
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => { setShowImport(false); setImportFile(null); setImportPreview(null); }}>
                Annulla
              </Button>
              {importPreview && (
                <Button onClick={handleImportConfirm} disabled={importing}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Importa {importPreview.count} voci
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
