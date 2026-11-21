"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, FilePlus2, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/components/sites/site-ui";
import { siteKey, siteRequest, useSiteMutation, type SiteData } from "./site-api";

// Documenti PDF del cantiere (B3): permessi, progetti, contratti. Il file va
// direttamente a Cloudinary con una firma del server (niente limite dei 4,5 MB
// delle funzioni), poi si registra. Si aprono in anteprima dentro l'app.

type Doc = NonNullable<SiteData["documents"]>[number];
type Sign = { uploadUrl: string; fields: Record<string, string>; maxBytes: number };

export function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Carica su Cloudinary con l'avanzamento (fetch non lo dà). */
function uploadWithProgress(url: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<{ public_id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error?.message ?? "Caricamento non riuscito"));
    };
    xhr.onerror = () => reject(new Error("Connessione assente"));
    xhr.send(form);
  });
}

export function DocumentsTab({
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
  const docs: Doc[] = data.documents ?? [];
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number; index: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);

  const remove = useSiteMutation<string>(
    siteId,
    (id) => siteRequest("DELETE", `/api/sites/${siteId}/documents/${id}`),
    (d, id) => ({ ...d, documents: (d.documents ?? []).filter((x) => x.id !== id) })
  );
  const rename = useSiteMutation<{ id: string; name: string }>(
    siteId,
    ({ id, name }) => siteRequest("PATCH", `/api/sites/${siteId}/documents/${id}`, { name }),
    (d, { id, name }) => ({ ...d, documents: (d.documents ?? []).map((x) => (x.id === id ? { ...x, name } : x)) })
  );

  async function upload(files: File[]) {
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (files.length && !pdfs.length) toast.error("Si possono caricare solo file PDF");
    if (!pdfs.length || uploading) return;
    let ok = 0;
    for (const [i, file] of pdfs.entries()) {
      setUploading({ name: file.name, progress: 0, index: i + 1, total: pdfs.length });
      try {
        const sign = await siteRequest<Sign>("POST", `/api/sites/${siteId}/documents/sign`);
        if (file.size > sign.maxBytes) throw new Error(`«${file.name}» supera i ${Math.round(sign.maxBytes / 1024 / 1024)} MB`);
        const form = new FormData();
        for (const [k, v] of Object.entries(sign.fields)) form.append(k, v);
        form.append("file", file);
        const up = await uploadWithProgress(sign.uploadUrl, form, (p) =>
          setUploading((u) => (u ? { ...u, progress: p } : u))
        );
        await siteRequest("POST", `/api/sites/${siteId}/documents`, { publicId: up.public_id, name: file.name });
        ok++;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `«${file.name}» non caricato`);
      }
    }
    setUploading(null);
    await qc.invalidateQueries({ queryKey: siteKey(siteId) });
    if (ok) toast.success(ok === 1 ? "Documento caricato" : `${ok} documenti caricati`);
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(e) => {
        if (!canManage || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={(e) => {
        if (!canManage) return;
        e.preventDefault();
        setDragOver(false);
        upload(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {docs.length === 0 ? "Nessun documento" : docs.length === 1 ? "1 documento" : `${docs.length} documenti`}
          <span className="hidden sm:inline"> · permessi, progetti, contratti (PDF fino a 25 MB)</span>
        </p>
        {canManage && (
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              onChange={(e) => {
                upload(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <Button className="ml-auto" onClick={() => input.current?.click()} disabled={!!uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
              {uploading
                ? `${uploading.total > 1 ? `${uploading.index}/${uploading.total} · ` : ""}${Math.round(uploading.progress * 100)}%`
                : "Aggiungi PDF"}
            </Button>
          </>
        )}
      </div>

      {docs.length === 0 ? (
        <div
          className={cn(
            "surface flex flex-col items-center gap-2 border-dashed py-12 text-center text-sm text-muted-foreground transition-colors",
            dragOver && "border-primary bg-primary/5"
          )}
        >
          <FileText className="h-8 w-8 opacity-50" />
          <p>{canManage ? <>Nessun documento. Trascina qui i PDF o usa <b>Aggiungi PDF</b>.</> : "Nessun documento."}</p>
        </div>
      ) : (
        <div className={cn("surface divide-y !p-0 transition-colors", dragOver && "ring-2 ring-primary/40")}>
          {docs.map((d) => {
            const mine = d.userId === userId || isAdmin;
            return (
              <div key={d.id} className="group flex items-center gap-3 px-3 py-2.5 md:px-4">
                <button
                  type="button"
                  onClick={() => setPreview(d)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  title="Apri l'anteprima"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                    <FileText className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[formatBytes(d.bytes), formatShortDate(d.createdAt), d.userName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Apri ${d.name} in una nuova scheda`}
                  title="Apri in una nuova scheda"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {canManage && mine && (
                  <>
                    <button
                      onClick={() => {
                        const name = prompt("Nome del documento", d.name.replace(/\.pdf$/i, ""));
                        if (name?.trim()) rename.mutate({ id: d.id, name: `${name.trim()}.pdf` });
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Rinomina"
                      title="Rinomina"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => confirm(`Eliminare «${d.name}»?`) && remove.mutate(d.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Elimina"
                      title="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="flex h-[90dvh] max-w-5xl flex-col gap-2 p-3 sm:p-4">
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="min-w-0 flex-1 truncate text-base">{preview?.name}</DialogTitle>
            <DialogDescription className="sr-only">Anteprima del documento</DialogDescription>
            {preview && (
              <Button asChild size="sm" variant="outline">
                <a href={preview.url} target="_blank" rel="noreferrer" download={preview.name}>
                  <Download /> Scarica
                </a>
              </Button>
            )}
          </div>
          {preview && <iframe src={preview.url} title={preview.name} className="min-h-0 flex-1 rounded-lg border bg-muted" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
