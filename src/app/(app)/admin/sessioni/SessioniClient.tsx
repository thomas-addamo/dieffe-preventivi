"use client";

import { useState } from "react";
import { Activity, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type SessionRow = {
  id: string;
  token: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  isImpersonated: boolean;
  userName: string;
  userEmail: string;
  userId: string;
};

function fmtDate(str: string) {
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(str));
  } catch {
    return str;
  }
}

function getBrowser(ua: string | null) {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30);
}

export function SessioniClient({ rows: initialRows, currentToken }: { rows: SessionRow[]; currentToken: string }) {
  const [rows, setRows] = useState(initialRows);
  const [terminating, setTerminating] = useState<string | null>(null);

  async function terminate(sessionId: string) {
    setTerminating(sessionId);
    const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: "DELETE" });
    setTerminating(null);
    if (res.ok) {
      setRows((r) => r.filter((s) => s.id !== sessionId));
      toast.success("Sessione terminata.");
    } else {
      toast.error("Errore durante la terminazione della sessione.");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Sessioni attive</h1>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Utente</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">IP</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Browser</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Creata</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Scade</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nessuna sessione attiva</td></tr>
            ) : rows.map((row) => {
              const isCurrent = row.token === currentToken;
              return (
                <tr key={row.id} className={`bg-card ${isCurrent ? "bg-blue-500/10 dark:bg-blue-500/20" : "hover:bg-muted/20"}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.userName}</div>
                    <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                    {isCurrent && <Badge variant="secondary" className="mt-1 text-xs bg-blue-100 text-blue-700">Sessione corrente</Badge>}
                    {row.isImpersonated && <Badge variant="secondary" className="mt-1 text-xs bg-orange-100 text-orange-700">Impersonata</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-xs">{row.ipAddress ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{getBrowser(row.userAgent)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{fmtDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{fmtDate(row.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => terminate(row.id)}
                        disabled={terminating === row.id}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Termina
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
