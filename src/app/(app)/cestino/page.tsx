"use client";

import { useEffect, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUserRole } from "@/components/shared/UserRoleContext";

type TrashQuote = {
  id: string;
  code: string;
  title: string;
  status: string;
  deletedAt: string | null;
  clientName: string | null;
  authorName: string;
  daysRemaining: number;
};

function fmtDate(str: string | null) {
  if (!str) return "—";
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(str));
  } catch {
    return str;
  }
}

export default function CestinoPage() {
  const role = useUserRole();
  const [quotes, setQuotes] = useState<TrashQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/quotes/trash");
    if (res.ok) setQuotes(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function restore(id: string) {
    setWorking(id);
    const res = await fetch(`/api/quotes/${id}/restore`, { method: "POST" });
    setWorking(null);
    if (res.ok) {
      setQuotes((q) => q.filter((x) => x.id !== id));
      toast.success("Preventivo ripristinato.");
    } else {
      toast.error("Errore durante il ripristino.");
    }
  }

  async function permanentDelete(id: string) {
    setWorking(id);
    const res = await fetch(`/api/quotes/${id}/permanent`, { method: "DELETE" });
    setWorking(null);
    setDeleteId(null);
    if (res.ok) {
      setQuotes((q) => q.filter((x) => x.id !== id));
      toast.success("Preventivo eliminato definitivamente.");
    } else {
      toast.error("Errore durante l'eliminazione.");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Trash2 className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Cestino</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-6 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        I preventivi nel cestino vengono eliminati automaticamente dopo 30 giorni.
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm py-12 text-center">Caricamento...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Il cestino è vuoto.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Codice</th>
                <th className="text-left px-4 py-3 font-medium">Titolo</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cliente</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Eliminato il</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Giorni rimasti</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map((q) => (
                <tr key={q.id} className="bg-card hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{q.code}</td>
                  <td className="px-4 py-3 font-medium">{q.title}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{q.clientName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmtDate(q.deletedAt)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`font-medium ${q.daysRemaining <= 7 ? "text-red-600" : "text-muted-foreground"}`}>
                      {q.daysRemaining} giorni
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restore(q.id)}
                        disabled={working === q.id}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Ripristina
                      </Button>
                      {role === "admin" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteId(q.id)}
                          disabled={working === q.id}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Elimina
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminazione definitiva</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Questa azione non può essere annullata. Il preventivo e tutti i suoi dati verranno eliminati permanentemente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annulla</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && permanentDelete(deleteId)}
            >
              Elimina definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
