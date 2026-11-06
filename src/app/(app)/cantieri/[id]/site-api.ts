"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SiteDetail } from "@/lib/sites/queries";

/** Come arriva dal server/JSON: le date sono stringhe. */
type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

export type SiteData = Jsonify<SiteDetail> & { insightsStale: boolean };
export type Phase = SiteData["phases"][number];
export type Milestone = SiteData["milestones"][number];
export type SiteEventRow = SiteData["events"][number];

export const siteKey = (id: string) => ["site", id] as const;

export async function siteRequest<T = unknown>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Operazione non riuscita");
  return data as T;
}

/**
 * Modifica di un elemento del cantiere con aggiornamento immediato
 * dell'interfaccia (`optimistic`) e riallineamento col server al termine.
 */
export function useSiteMutation<V>(
  siteId: string,
  fn: (vars: V) => Promise<unknown>,
  optimistic?: (data: SiteData, vars: V) => SiteData
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: async (vars: V) => {
      if (!optimistic) return {};
      await qc.cancelQueries({ queryKey: siteKey(siteId) });
      const prev = qc.getQueryData<SiteData>(siteKey(siteId));
      if (prev) qc.setQueryData(siteKey(siteId), optimistic(prev, vars));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx && "prev" in ctx && ctx.prev) qc.setQueryData(siteKey(siteId), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: siteKey(siteId) });
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

export const TRIGGER_LABELS: Record<string, string> = {
  accept: "All'accettazione",
  start: "A inizio lavori",
  phase: "A fine fase",
  end: "A fine lavori",
  manual: "Da segnare a mano",
};
