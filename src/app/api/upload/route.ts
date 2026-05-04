import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { quoteItemImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function isValidImage(buf: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png")
    return buf
      .slice(0, 8)
      .equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
  if (mime === "image/webp")
    return (
      buf.slice(0, 4).toString() === "RIFF" &&
      buf.slice(8, 12).toString() === "WEBP"
    );
  return false;
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session)
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const formData = await req.formData();
  const quoteId = formData.get("quoteId") as string;
  const itemId = formData.get("itemId") as string;
  const file = formData.get("file") as File | null;

  if (!quoteId || !itemId || !file) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato non supportato" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File troppo grande (max 5MB)" },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes);

  if (!isValidImage(buf, file.type)) {
    return NextResponse.json({ error: "File non valido" }, { status: 400 });
  }

  const safeQuoteId = quoteId.replace(/[^a-f0-9-]/gi, "");
  const safeItemId = itemId.replace(/[^a-f0-9-]/gi, "");
  const imgId = generateId(8);
  const folder = `dieffe-preventivi/${safeQuoteId}/${safeItemId}`;

  const { publicId, url } = await uploadToCloudinary(buf, folder, imgId);

  const id = generateId();
  const existing = await db
    .select()
    .from(quoteItemImages)
    .where(eq(quoteItemImages.itemId, itemId));
  const orderIndex = existing.length;

  await db.insert(quoteItemImages).values({
    id,
    itemId,
    cloudinaryPublicId: publicId,
    cloudinaryUrl: url,
    orderIndex,
  });

  return NextResponse.json(
    { id, cloudinaryPublicId: publicId, cloudinaryUrl: url },
    { status: 201 }
  );
}
