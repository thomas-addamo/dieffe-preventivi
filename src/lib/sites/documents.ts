import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { siteDocuments } from "@/lib/db/schema";
import { cloudinary, deleteCloudinaryAsset } from "@/lib/cloudinary";
import { generateId } from "@/lib/utils";
import { sitePhotoFolder } from "./complete";

// ─────────────────────────────────────────────────────────────────────────────
// Documenti PDF del cantiere (B3).
// I PDF possono pesare decine di MB: superano il limite di 4,5 MB delle
// funzioni Vercel, quindi il file va DIRETTAMENTE dal sito/iPhone a Cloudinary
// con una firma rilasciata qui (valida un'ora, solo per quella cartella e quel
// nome). Poi il client registra il documento: il server rilegge il file da
// Cloudinary (dimensione, indirizzo) prima di salvarlo, quindi non si fida dei
// dati del client. Nel DB solo il riferimento.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

type Result = { ok: true; data?: unknown } | { ok: false; status: number; error: string };

const folderOf = (siteId: string) => `${sitePhotoFolder(siteId)}/documenti`;

/** Nome leggibile e sicuro, sempre con estensione .pdf. */
export function cleanDocumentName(name: string) {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Documento";
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

/** Parametri firmati per caricare un PDF direttamente su Cloudinary. */
export function signDocumentUpload(siteId: string) {
  const folder = folderOf(siteId);
  // Per i file "raw" l'estensione fa parte del public_id: serve perché il
  // browser e l'iPhone aprano il file come PDF.
  const publicId = `${generateId(12)}.pdf`;
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder, public_id: publicId, timestamp };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    fields: { api_key: process.env.CLOUDINARY_API_KEY!, timestamp: String(timestamp), signature, folder, public_id: publicId },
    maxBytes: MAX_DOCUMENT_BYTES,
  };
}

/** Registra un PDF già caricato con la firma: verifica che esista e il peso. */
export async function addSiteDocument(siteId: string, body: unknown, userId: string): Promise<Result> {
  const b = (body ?? {}) as { publicId?: unknown; name?: unknown };
  const publicId = typeof b.publicId === "string" ? b.publicId : "";
  // Solo file della cartella di QUESTO cantiere, con il nome generato da noi.
  if (!publicId.startsWith(`${folderOf(siteId)}/`) || !/^[\w/-]+\.pdf$/.test(publicId))
    return { ok: false, status: 400, error: "Documento non valido" };

  let res: { secure_url: string; bytes: number };
  try {
    res = await cloudinary.api.resource(publicId, { resource_type: "raw" });
  } catch {
    return { ok: false, status: 400, error: "File non trovato: ricarica il documento" };
  }
  if (res.bytes > MAX_DOCUMENT_BYTES) {
    await deleteCloudinaryAsset(publicId, "raw").catch(() => {});
    return { ok: false, status: 413, error: "Documento troppo grande (max 25 MB)" };
  }
  const row = {
    id: generateId(),
    siteId,
    publicId,
    url: res.secure_url,
    name: cleanDocumentName(typeof b.name === "string" ? b.name : ""),
    bytes: res.bytes,
    userId,
    createdAt: new Date(),
  };
  await db.insert(siteDocuments).values(row);
  return { ok: true, data: row };
}

export async function renameSiteDocument(siteId: string, docId: string, body: unknown): Promise<Result> {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string" || !name.trim()) return { ok: false, status: 400, error: "Nome non valido" };
  await db
    .update(siteDocuments)
    .set({ name: cleanDocumentName(name) })
    .where(and(eq(siteDocuments.id, docId), eq(siteDocuments.siteId, siteId)));
  return { ok: true };
}

export async function deleteSiteDocument(siteId: string, docId: string, user: { id: string; role: string }): Promise<Result> {
  const [doc] = await db
    .select({ userId: siteDocuments.userId, publicId: siteDocuments.publicId })
    .from(siteDocuments)
    .where(and(eq(siteDocuments.id, docId), eq(siteDocuments.siteId, siteId)))
    .limit(1);
  if (!doc) return { ok: true };
  if (doc.userId !== user.id && user.role !== "admin") return { ok: false, status: 403, error: "Puoi eliminare solo i tuoi documenti" };
  await db.delete(siteDocuments).where(eq(siteDocuments.id, docId));
  await deleteCloudinaryAsset(doc.publicId, "raw").catch(() => {});
  return { ok: true };
}

/** Link firmato e a tempo (15 min) per aprire o scaricare il PDF. */
export function signedDocumentUrl(publicId: string, download = false) {
  return cloudinary.utils.private_download_url(publicId, undefined as unknown as string, {
    resource_type: "raw",
    type: "upload",
    attachment: download,
    expires_at: Math.round(Date.now() / 1000) + 15 * 60,
  });
}
