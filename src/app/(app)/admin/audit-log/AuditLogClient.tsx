"use client";

import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { Page, PageHeader } from "@/components/shared/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  "quote.deleted": "Preventivo eliminato",
  "quote.restored": "Preventivo ripristinato",
  "quote.permanently_deleted": "Preventivo eliminato definitivamente",
  "quote.signature_revoked": "Firma annullata",
  "quote.reassigned": "Preventivo riassegnato",
  "quote.locked": "Preventivo bloccato",
  "quote.unlocked": "Preventivo sbloccato",
};

function fmtAction(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function fmtDate(str: string) {
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(str));
  } catch {
    return str;
  }
}

const PAGE_SIZE = 50;

export function AuditLogClient({ initialRows }: { initialRows: AuditRow[] }) {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [page, setPage] = useState(0);
  const [detailRow, setDetailRow] = useState<AuditRow | null>(null);

  const uniqueActions = useMemo(() => Array.from(new Set(initialRows.map((r) => r.action))).sort(), [initialRows]);
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of initialRows) {
      if (r.userEmail && r.userName) map.set(r.userEmail, r.userName);
    }
    return Array.from(map.entries());
  }, [initialRows]);

  const filtered = useMemo(() => {
    return initialRows.filter((r) => {
      if (filterAction !== "all" && r.action !== filterAction) return false;
      if (filterUser !== "all" && r.userEmail !== filterUser) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.action.toLowerCase().includes(q) && !r.entityId?.toLowerCase().includes(q) && !r.userName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [initialRows, filterAction, filterUser, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function exportCsv() {
    const header = ["Data/Ora", "Utente", "Azione", "Entità", "ID entità"];
    const rows = filtered.map((r) => [
      fmtDate(r.createdAt),
      r.userName ?? "—",
      fmtAction(r.action),
      r.entityType,
      r.entityId ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Page>
      <PageHeader
        title="Audit log"
        subtitle={`${filtered.length} eventi`}
        actions={
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Esporta CSV</span>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Cerca..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="sm:max-w-xs"
        />
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tutte le azioni" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le azioni</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>{fmtAction(a)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={(v) => { setFilterUser(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tutti gli utenti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli utenti</SelectItem>
            {uniqueUsers.map(([email, name]) => (
              <SelectItem key={email} value={email}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="surface overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Data/Ora</th>
              <th className="text-left px-4 py-3 font-medium">Utente</th>
              <th className="text-left px-4 py-3 font-medium">Azione</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Entità</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">Nessun evento trovato</td>
              </tr>
            ) : paged.map((row) => (
              <tr
                key={row.id}
                className="bg-card hover:bg-muted/20 cursor-pointer"
                onClick={() => setDetailRow(row)}
              >
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                <td className="px-4 py-3">{row.userName ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 font-medium">{fmtAction(row.action)}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{row.entityType}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">{row.entityId?.slice(0, 12) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Precedente
          </Button>
          <span className="text-sm text-muted-foreground">Pagina {page + 1} di {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Successiva
          </Button>
        </div>
      )}

      <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettaglio evento</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold">Data:</span> {fmtDate(detailRow.createdAt)}</div>
              <div><span className="font-semibold">Utente:</span> {detailRow.userName ?? "—"} {detailRow.userEmail && `(${detailRow.userEmail})`}</div>
              <div><span className="font-semibold">Azione:</span> {fmtAction(detailRow.action)}</div>
              <div><span className="font-semibold">Entità:</span> {detailRow.entityType} / {detailRow.entityId ?? "—"}</div>
              <div>
                <span className="font-semibold">Dati:</span>
                <pre className="mt-2 bg-muted rounded-lg p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(detailRow.changes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}
