"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, ImagePlus, Images, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { photoUrl, preparePhoto } from "@/components/sites/site-ui";
import { siteKey, useSiteMutation, siteRequest, type SiteData, type SitePhotoRow } from "./site-api";

// Foto di cantiere: si caricano dal computer (anche trascinandole qui) o dal
// telefono, ridimensionate prima dell'invio. Ogni foto può avere una
// didascalia e la fase a cui si riferisce; si filtrano per fase.

const ALL = "__all";

export function PhotosTab({
  data,
  canManage,
  userId,
  isAdmin,
}: {
  data: SiteData;
  canManage: boolean;
  userId: string;
  isAdmin: boolean;
}) {
  const siteId = data.site.id;
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<string>(ALL);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const photos = phase === ALL ? data.photos : data.photos.filter((p) => p.phaseId === phase);
  const phaseTitle = new Map(data.phases.map((p) => [p.id, p.title]));

  async function upload(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!images.length || uploading) return;
    setUploading({ done: 0, total: images.length });
    let failed = 0;
    for (const [i, file] of images.entries()) {
      const blob = await preparePhoto(file);
      if (!blob) {
        failed++;
      } else {
        const fd = new FormData();
        fd.append("file", blob, file.name.replace(/\.\w+$/, "") + ".jpg");
        if (phase !== ALL) fd.append("phaseId", phase);
        const res = await fetch(`/api/sites/${siteId}/photos`, { method: "POST", body: fd }).catch(() => null);
        if (!res?.ok) failed++;
      }
      setUploading({ done: i + 1, total: images.length });
    }
    await qc.invalidateQueries({ queryKey: siteKey(siteId) });
    setUploading(null);
    if (failed) toast.error(failed === 1 ? "Una foto non è stata caricata" : `${failed} foto non sono state caricate`);
    else toast.success(images.length === 1 ? "Foto caricata" : `${images.length} foto caricate`);
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(e) => {
        if (!canManage || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!canManage) return;
        e.preventDefault();
        setDragOver(false);
        upload(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="h-9 rounded-xl border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Filtra per fase"
        >
          <option value={ALL}>Tutte le foto ({data.photos.length})</option>
          {data.phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({data.photos.filter((x) => x.phaseId === p.id).length})
            </option>
          ))}
        </select>
        {canManage && (
          <>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                upload(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <Button className="ml-auto" onClick={() => input.current?.click()} disabled={!!uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {uploading ? `Caricamento ${uploading.done}/${uploading.total}…` : "Aggiungi foto"}
            </Button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <div
          className={cn(
            "surface flex flex-col items-center gap-2 border-dashed py-12 text-center text-sm text-muted-foreground transition-colors",
            dragOver && "border-primary bg-primary/5"
          )}
        >
          <Images className="h-8 w-8 opacity-50" />
          {canManage ? (
            <p>
              Nessuna foto{phase !== ALL ? " per questa fase" : ""}. Trascinale qui o usa <b>Aggiungi foto</b>
              {phase !== ALL ? `: verranno collegate a «${phaseTitle.get(phase)}»` : ""}.
            </p>
          ) : (
            <p>Nessuna foto.</p>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 gap-2 rounded-2xl transition-colors sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
            dragOver && "bg-primary/5 ring-2 ring-primary/40"
          )}
        >
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setOpen(i)}
              className="group relative aspect-square overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.url, 400, true)} alt={p.caption ?? "Foto di cantiere"} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-left text-[11px] text-white">
                <span className="line-clamp-1 font-medium">{p.caption || (p.phaseId ? phaseTitle.get(p.phaseId) : "")}</span>
                <span className="opacity-80">{new Date(p.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open != null && photos[open] && (
        <PhotoViewer
          data={data}
          photos={photos}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          canEdit={(p) => canManage && (p.userId === userId || isAdmin)}
          canManage={canManage}
        />
      )}
    </div>
  );
}

function PhotoViewer({
  data,
  photos,
  index,
  onIndex,
  onClose,
  canEdit,
  canManage,
}: {
  data: SiteData;
  photos: SitePhotoRow[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  canEdit: (p: SitePhotoRow) => boolean;
  canManage: boolean;
}) {
  const siteId = data.site.id;
  const p = photos[index];

  const patch = useSiteMutation<{ id: string; body: { caption?: string | null; phaseId?: string | null } }>(
    siteId,
    ({ id, body }) => siteRequest("PATCH", `/api/sites/${siteId}/photos/${id}`, body),
    (d, { id, body }) => ({ ...d, photos: d.photos.map((x) => (x.id === id ? { ...x, ...body } : x)) })
  );
  const remove = useSiteMutation<string>(
    siteId,
    (id) => siteRequest("DELETE", `/api/sites/${siteId}/photos/${id}`),
    (d, id) => ({ ...d, photos: d.photos.filter((x) => x.id !== id) })
  );

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, photos.length, onIndex]);


  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl gap-3 p-3 sm:p-4">
        <DialogTitle className="sr-only">Foto {index + 1} di {photos.length}</DialogTitle>
        <DialogDescription className="sr-only">{p.caption ?? "Foto di cantiere"}</DialogDescription>
        <div className="relative flex max-h-[70vh] items-center justify-center overflow-hidden rounded-xl bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(p.url, 1600)} alt={p.caption ?? "Foto di cantiere"} className="max-h-[70vh] w-auto object-contain" />
          {index > 0 && (
            <button onClick={() => onIndex(index - 1)} className="absolute left-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" aria-label="Foto precedente">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {index < photos.length - 1 && (
            <button onClick={() => onIndex(index + 1)} className="absolute right-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" aria-label="Foto successiva">
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {canEdit(p) ? (
            <input
              key={p.id}
              defaultValue={p.caption ?? ""}
              onBlur={(e) => {
                const c = e.currentTarget.value.trim() || null;
                if (c !== (p.caption ?? null)) patch.mutate({ id: p.id, body: { caption: c } });
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              placeholder="Aggiungi una didascalia…"
              maxLength={300}
              className="h-9 min-w-0 flex-1 rounded-xl border bg-background px-3 outline-none focus:ring-2 focus:ring-ring/40"
            />
          ) : (
            <p className="min-w-0 flex-1 truncate">{p.caption || <span className="text-muted-foreground">Senza didascalia</span>}</p>
          )}
          {canManage ? (
            <select
              value={p.phaseId ?? ""}
              onChange={(e) => patch.mutate({ id: p.id, body: { phaseId: e.target.value || null } })}
              className="h-9 max-w-[45%] rounded-xl border bg-card px-2 outline-none focus:ring-2 focus:ring-ring/40"
              aria-label="Fase della foto"
            >
              <option value="">Nessuna fase</option>
              {data.phases.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.title}
                </option>
              ))}
            </select>
          ) : null}
          <Button asChild size="icon" variant="ghost" title="Apri l'originale">
            <a href={p.url} target="_blank" rel="noreferrer" aria-label="Apri l'originale">
              <Download />
            </a>
          </Button>
          {canEdit(p) && (
            <Button
              size="icon"
              variant="ghost"
              className="hover:bg-red-500/10 hover:text-red-600"
              aria-label="Elimina foto"
              onClick={() => {
                if (!confirm("Eliminare la foto?")) return;
                remove.mutate(p.id);
                if (photos.length <= 1) onClose();
                else if (index >= photos.length - 1) onIndex(index - 1);
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {p.userName ?? "—"} · {new Date(p.createdAt).toLocaleString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {index + 1} di {photos.length}
        </p>
      </DialogContent>
    </Dialog>
  );
}
