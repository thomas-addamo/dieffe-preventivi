import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function isValidImage(buf: Buffer, mime: string): boolean {
  if (mime === "image/svg+xml") return true; // text, skip magic bytes
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png")
    return buf
      .slice(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp")
    return (
      buf.slice(0, 4).toString() === "RIFF" &&
      buf.slice(8, 12).toString() === "WEBP"
    );
  return false;
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "File mancante" }, { status: 400 });

  if (!ALLOWED_MIME.includes(file.type))
    return NextResponse.json(
      { error: "Formato non supportato. Usa PNG, JPG, WEBP o SVG." },
      { status: 400 }
    );

  if (file.size > MAX_SIZE)
    return NextResponse.json(
      { error: "File troppo grande (max 2MB)" },
      { status: 400 }
    );

  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes);

  if (!isValidImage(buf, file.type))
    return NextResponse.json({ error: "File non valido" }, { status: 400 });

  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const filename = `logo.${ext}`;
  const logoDir = path.join(process.cwd(), "storage", "logo");
  await fs.mkdir(logoDir, { recursive: true });

  // remove old logos
  try {
    const existing = await fs.readdir(logoDir);
    for (const f of existing) {
      if (f.startsWith("logo.")) await fs.unlink(path.join(logoDir, f));
    }
  } catch {}

  await fs.writeFile(path.join(logoDir, filename), buf);
  const logoPath = `/storage/logo/${filename}`;

  await db
    .update(companySettings)
    .set({ logoPath, updatedAt: new Date().toISOString() })
    .where(sql`1 = 1`);

  return NextResponse.json({ logoPath });
}

export async function DELETE() {
  const session = await getCurrentUser();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });

  const logoDir = path.join(process.cwd(), "storage", "logo");
  try {
    const files = await fs.readdir(logoDir);
    for (const f of files) {
      if (f.startsWith("logo.")) await fs.unlink(path.join(logoDir, f));
    }
  } catch {}

  await db
    .update(companySettings)
    .set({ logoPath: null, updatedAt: new Date().toISOString() })
    .where(sql`1 = 1`);

  return NextResponse.json({ ok: true });
}
