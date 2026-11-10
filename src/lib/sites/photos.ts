import "server-only";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sitePhases, sitePhotos } from "@/lib/db/schema";
import { deleteCloudinaryAsset, uploadToCloudinary } from "@/lib/cloudinary";
import { generateId } from "@/lib/utils";
import { sitePhotoFolder } from "./complete";

// ─────────────────────────────────────────────────────────────────────────────
// Foto di cantiere: su Cloudinary (cartella del cantiere), nel DB solo il
// riferimento. Il sito e l'app iPhone ridimensionano le foto prima di inviarle
// (lato lungo 2.000 px, JPEG): restano sotto il limite di 4,5 MB delle
// funzioni Vercel e si caricano in fretta anche in cantiere con poco segnale.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

function looksLikeImage(buf: Buffer, mime: string) {
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png") return buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === "image/webp") return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  return false;
}

type Result = { ok: true; data?: unknown } | { ok: false; status: number; error: string };

async function phaseBelongs(siteId: string, phaseId: string | null | undefined) {
  if (!phaseId) return true;
  const [p] = await db.select({ id: sitePhases.id }).from(sitePhases).where(and(eq(sitePhases.id, phaseId), eq(sitePhases.siteId, siteId))).limit(1);
  return !!p;
}

export async function addSitePhoto(siteId: string, form: FormData, userId: string): Promise<Result> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, status: 400, error: "Nessuna foto" };
  if (!ALLOWED.includes(file.type)) return { ok: false, status: 400, error: "Formato non supportato (JPEG, PNG o WebP)" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, status: 413, error: "Foto troppo grande (max 4 MB)" };
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300) || null;
  const phaseId = String(form.get("phaseId") ?? "").trim() || null;
  if (!(await phaseBelongs(siteId, phaseId))) return { ok: false, status: 400, error: "Fase non trovata" };

  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf, file.type)) return { ok: false, status: 400, error: "File non valido" };

  const up = await uploadToCloudinary(buf, sitePhotoFolder(siteId), generateId(10));
  const row = {
    id: generateId(),
    siteId,
    phaseId,
    publicId: up.publicId,
    url: up.url,
    width: up.width ?? null,
    height: up.height ?? null,
    caption,
    userId,
    createdAt: new Date(),
  };
  await db.insert(sitePhotos).values(row);
  return { ok: true, data: row };
}

const photoPatch = z.object({
  caption: z.string().trim().max(300).nullable().optional(),
  phaseId: z.string().nullable().optional(),
});

export async function updateSitePhoto(siteId: string, photoId: string, body: unknown): Promise<Result> {
  const p = photoPatch.safeParse(body);
  if (!p.success) return { ok: false, status: 400, error: "Dati non validi" };
  if (!(await phaseBelongs(siteId, p.data.phaseId))) return { ok: false, status: 400, error: "Fase non trovata" };
  const set = { ...p.data, caption: p.data.caption === undefined ? undefined : p.data.caption || null };
  await db.update(sitePhotos).set(set).where(and(eq(sitePhotos.id, photoId), eq(sitePhotos.siteId, siteId)));
  return { ok: true };
}

export async function deleteSitePhoto(siteId: string, photoId: string, user: { id: string; role: string }): Promise<Result> {
  const [ph] = await db
    .select({ userId: sitePhotos.userId, publicId: sitePhotos.publicId })
    .from(sitePhotos)
    .where(and(eq(sitePhotos.id, photoId), eq(sitePhotos.siteId, siteId)))
    .limit(1);
  if (!ph) return { ok: true };
  if (ph.userId !== user.id && user.role !== "admin") return { ok: false, status: 403, error: "Puoi eliminare solo le tue foto" };
  await db.delete(sitePhotos).where(eq(sitePhotos.id, photoId));
  await deleteCloudinaryAsset(ph.publicId).catch(() => {});
  return { ok: true };
}
