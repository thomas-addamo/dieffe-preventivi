"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, HardHat, ImagePlus, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { photoUrl, preparePhoto } from "@/components/sites/site-ui";
import { LogisticsPicker } from "@/components/sites/SiteLogistics";
import type { SurveyBoard } from "@/lib/sites/survey-board";

// ─────────────────────────────────────────────────────────────────────────────
// Pannello laterale «Sopralluogo» del preventivo, disponibile già dalla bozza:
// annotazioni, foto preliminari e logistica di cantiere. Quando il preventivo
// diventa cantiere, note e foto compaiono anche nella pagina cantiere (stesse
// righe nel DB, nessuna copia). Si carica solo all'apertura del pannello.
// ─────────────────────────────────────────────────────────────────────────────

type Board = {
  [K in keyof SurveyBoard]: SurveyBoard[K] extends (infer U)[]
    ? { [P in keyof U]: U[P] extends Date ? string : U[P] extends Date | null ? string | null : U[P] }[]
    : SurveyBoard[K] extends Date | null
      ? string | null
      : SurveyBoard[K];
};

const boardKey = (quoteId: string) => ["survey-board", quoteId] as const;

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Operazione non riuscita");
  return data as T;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Modifica del pannello con aggiornamento immediato e riallineamento col server. */
function useBoardMutation<V>(quoteId: string, siteId: string | null, fn: (v: V) => Promise<unknown>, optimistic: (d: Board, v: V) => Board) {
  const qc = useQueryClient();
  const key = boardKey(quoteId);
  return useMutation({
    mutationFn: fn,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Board>(key);
      if (prev) qc.setQueryData(key, optimistic(prev, v));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      if (siteId) qc.invalidateQueries({ queryKey: ["site", siteId] });
    },
  });
}

export function SurveyBoardPanel({
  open,
  onOpenChange,
  quoteId,
  isExtra,
  siteId,
  canWrite,
  userId,
  userName,
  isAdmin,
  onCountChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  isExtra: boolean;
  siteId: string | null;
  canWrite: boolean;
  userId: string;
  userName: string;
  isAdmin: boolean;
  onCountChange?: (n: number) => void;
}) {
  const qc = useQueryClient();
  const key = boardKey(quoteId);
  const base = `/api/quotes/${quoteId}/survey-board`;
  const { data, isLoading, isError, refetch } = useQuery<Board>({
    queryKey: key,
    queryFn: () => request<Board>("GET", base),
    enabled: open,
    staleTime: 30_000,
  });

  const setLogistics = useBoardMutation<number | null>(
    quoteId,
    siteId,
    (level) => request("PATCH", base, { logistics: level }),
    (d, level) => ({ ...d, logistics: level, logisticsBy: level ? userName : null, logisticsAt: level ? new Date().toISOString() : null })
  );
  const addNote = useBoardMutation<string>(
    quoteId,
    siteId,
    (body) => request("POST", `${base}/notes`, { body }),
    (d, body) => ({
      ...d,
      notes: [{ id: `tmp-${Date.now()}`, body, createdAt: new Date().toISOString(), updatedAt: null, userId, userName }, ...d.notes],
    })
  );
  const editNote = useBoardMutation<{ id: string; body: string }>(
    quoteId,
    siteId,
    ({ id, body }) => request("PATCH", `${base}/notes/${id}`, { body }),
    (d, { id, body }) => ({ ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, body, updatedAt: new Date().toISOString() } : n)) })
  );
  const removeNote = useBoardMutation<string>(
    quoteId,
    siteId,
    (id) => request("DELETE", `${base}/notes/${id}`),
    (d, id) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })
  );
  const removePhoto = useBoardMutation<string>(
    quoteId,
    siteId,
    (id) => request("DELETE", `/api/quotes/${quoteId}/photos/${id}`),
    (d, id) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) })
  );

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!images.length || uploading) return;
    setUploading({ done: 0, total: images.length });
    let failed = 0;
    for (const [i, file] of images.entries()) {
      const blob = await preparePhoto(file);
      if (!blob) failed++;
      else {
        const fd = new FormData();
        fd.append("file", blob, file.name.replace(/\.\w+$/, "") + ".jpg");
        const res = await fetch(`/api/quotes/${quoteId}/photos`, { method: "POST", body: fd }).catch(() => null);
        if (!res?.ok) failed++;
      }
      setUploading({ done: i + 1, total: images.length });
    }
    await qc.invalidateQueries({ queryKey: key });
    if (siteId) qc.invalidateQueries({ queryKey: ["site", siteId] });
    setUploading(null);
    if (failed) toast.error(failed === 1 ? "Una foto non è stata caricata" : `${failed} foto non sono state caricate`);
  }

  // Il numero sul tasto segue le modifiche fatte dal pannello.
  const count = data ? data.notes.length + data.photos.length : null;
  useEffect(() => {
    if (count != null) onCountChange?.(count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:[animation:apple-fade-in_0.24s_ease-out_both] data-[state=closed]:[animation:apple-fade-out_0.18s_ease-in_both]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right duration-300"
          )}
          onDragOver={(e) => canWrite && e.dataTransfer.types.includes("Files") && e.preventDefault()}
          onDrop={(e) => {
            if (!canWrite) return;
            e.preventDefault();
            upload(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold">
                <ClipboardList className="h-4 w-4 text-primary" /> Sopralluogo
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {siteId ? "Note e foto sono anche nella pagina del cantiere." : "Note e foto passano al cantiere quando il preventivo viene inviato."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Chiudi">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-4">
            {isLoading && (
              <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carico…
              </p>
            )}
            {isError && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Non riesco a caricare il sopralluogo.{" "}
                <button className="font-medium text-primary" onClick={() => refetch()}>
                  Riprova
                </button>
              </div>
            )}
            {data && (
              <>
                <section>
                  <h3 className="mb-1 text-sm font-semibold">Logistica di cantiere</h3>
                  <p className="mb-2.5 text-xs text-muted-foreground">
                    {data.logistics && data.logisticsAt
                      ? `Indicata da ${data.logisticsBy ?? "—"} · ${fmt(data.logisticsAt)}`
                      : "Spunta com'è l'accesso, una volta fatto il sopralluogo."}
                    {isExtra && " Vale per tutto il cantiere (è la stessa del preventivo principale)."}
                  </p>
                  <LogisticsPicker value={data.logistics} onChange={(l) => setLogistics.mutate(l)} disabled={!canWrite} />
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    Annotazioni {data.notes.length > 0 && <span className="font-normal text-muted-foreground">({data.notes.length})</span>}
                  </h3>
                  {canWrite && (
                    <form
                      className="mb-3 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!draft.trim()) return;
                        addNote.mutate(draft.trim());
                        setDraft("");
                      }}
                    >
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                        }}
                        rows={3}
                        maxLength={4000}
                        placeholder="Es. contatore in cantina, chiavi dal vicino, muro portante da verificare…"
                        className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                      />
                      <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={!draft.trim()}>
                          <Send /> Aggiungi annotazione
                        </Button>
                      </div>
                    </form>
                  )}
                  {data.notes.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">Nessuna annotazione.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.notes.map((n) => {
                        const mine = canWrite && !n.id.startsWith("tmp-") && (n.userId === userId || isAdmin);
                        return (
                          <li key={n.id} className="group rounded-xl border bg-card px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span>
                                {n.userName ?? "—"} · {fmt(n.createdAt)}
                                {n.updatedAt && " · modificata"}
                              </span>
                              {mine && editing !== n.id && (
                                <span className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                                  <button onClick={() => setEditing(n.id)} className="rounded p-1 hover:bg-accent hover:text-foreground" aria-label="Modifica annotazione">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => confirm("Eliminare l'annotazione?") && removeNote.mutate(n.id)}
                                    className="rounded p-1 hover:bg-red-500/10 hover:text-red-600"
                                    aria-label="Elimina annotazione"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              )}
                            </div>
                            {editing === n.id ? (
                              <form
                                className="mt-2 space-y-2"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const text = String(new FormData(e.currentTarget).get("body") ?? "").trim();
                                  if (text && text !== n.body) editNote.mutate({ id: n.id, body: text });
                                  setEditing(null);
                                }}
                              >
                                <textarea
                                  name="body"
                                  defaultValue={n.body}
                                  autoFocus
                                  maxLength={4000}
                                  rows={Math.min(8, Math.max(3, n.body.split("\n").length + 1))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                  className="w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                    Annulla
                                  </Button>
                                  <Button type="submit" size="sm">
                                    Salva
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{n.body}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Foto {data.photos.length > 0 && <span className="font-normal text-muted-foreground">({data.photos.length})</span>}
                    </h3>
                    {canWrite && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={!!uploading}>
                          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                          {uploading ? `${uploading.done}/${uploading.total}` : "Aggiungi foto"}
                        </Button>
                        <input
                          ref={fileInput}
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={(e) => {
                            upload(Array.from(e.target.files ?? []));
                            e.target.value = "";
                          }}
                        />
                      </>
                    )}
                  </div>
                  {data.photos.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
                      Nessuna foto{canWrite ? ": aggiungile da qui (anche trascinandole) o dal sopralluogo su iPhone." : "."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {data.photos.map((p) => {
                        const deletable = canWrite && p.quoteId === quoteId && (p.userId === userId || isAdmin);
                        return (
                          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                            <a href={photoUrl(p.url, 1600)} target="_blank" rel="noreferrer" title={p.caption ?? undefined}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={photoUrl(p.url, 300, true)} alt={p.caption ?? "Foto del sopralluogo"} loading="lazy" className="h-full w-full object-cover" />
                            </a>
                            {deletable && (
                              <button
                                onClick={() => confirm("Eliminare la foto?") && removePhoto.mutate(p.id)}
                                className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-100 hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
                                aria-label="Elimina foto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {siteId && (
            <div className="border-t px-5 py-3">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/cantieri/${siteId}`}>
                  <HardHat /> Apri il cantiere
                </Link>
              </Button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
