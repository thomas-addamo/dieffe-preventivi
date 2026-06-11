import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/permissions/guard";
import { isAiConfigured } from "@/lib/ai/client";
import {
  extractTextFromFile,
  UnsupportedFileError,
} from "@/lib/import/extract-text";
import { parseQuoteFromText, QuoteParseError } from "@/lib/import/parse-quote";
import { db } from "@/lib/db/client";
import { clients, quoteSections, quoteItems } from "@/lib/db/schema";
import { ilike } from "drizzle-orm";
import { createQuote } from "@/lib/db/quotes";
import { generateId } from "@/lib/utils";
import { calcItemTotal } from "@/lib/calculations";

// L'analisi AI di un documento lungo può richiedere più dei 10s di default.
export const maxDuration = 60;

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

const SECTION_CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ─── Fase 2: creazione preventivo dai dati confermati ────────────────────────

const itemSchema = z.object({
  description: z.string().min(1).max(2000),
  unitOfMeasure: z.string().min(1).max(20),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
});

const sectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  lumpSumPrice: z.number().min(0).nullable().optional(),
  items: z.array(itemSchema).min(1).max(300),
});

const createSchema = z.object({
  title: z.string().min(1).max(300),
  clientMode: z.enum(["existing", "new", "none"]),
  clientId: z.string().optional(),
  client: z
    .object({
      name: z.string().min(1).max(200),
      address: z.string().max(300).nullable().optional(),
      email: z.string().max(200).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      vatNumber: z.string().max(50).nullable().optional(),
    })
    .optional(),
  projectAddress: z.string().max(300).nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
  paymentTerms: z.string().max(1000).nullable().optional(),
  validUntil: z.string().max(30).nullable().optional(),
  sections: z.array(sectionSchema).min(1).max(40),
});

async function handleCreate(req: NextRequest, userId: string) {
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  let clientId: string | null = null;
  if (data.clientMode === "existing" && data.clientId) {
    clientId = data.clientId;
  } else if (data.clientMode === "new" && data.client) {
    clientId = generateId();
    await db.insert(clients).values({
      id: clientId,
      name: data.client.name,
      address: data.client.address ?? null,
      email: data.client.email ?? null,
      phone: data.client.phone ?? null,
      vatNumber: data.client.vatNumber ?? null,
    });
  }

  const quoteId = await createQuote(userId, {
    title: data.title,
    clientId,
    projectAddress: data.projectAddress ?? null,
    vatRate: data.vatRate,
    notes: data.notes ?? null,
    paymentTerms: data.paymentTerms ?? null,
    validUntil: data.validUntil ?? null,
  });

  const sectionRows = data.sections.map((s, i) => ({
    id: generateId(),
    quoteId,
    code: SECTION_CODES[i] ?? String(i + 1),
    title: s.title,
    description: s.description ?? null,
    orderIndex: i,
    lumpSum: s.lumpSumPrice != null && s.lumpSumPrice > 0,
    lumpSumPrice: s.lumpSumPrice != null && s.lumpSumPrice > 0 ? s.lumpSumPrice : null,
  }));
  await db.insert(quoteSections).values(sectionRows);

  const itemRows = data.sections.flatMap((s, i) =>
    s.items.map((item, j) => ({
      id: generateId(),
      sectionId: sectionRows[i].id,
      description: item.description,
      unitOfMeasure: item.unitOfMeasure,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: calcItemTotal(item.quantity, item.unitPrice, item.discount),
      orderIndex: j,
    }))
  );
  await db.insert(quoteItems).values(itemRows);

  return NextResponse.json({ id: quoteId }, { status: 201 });
}

// ─── Fase 1: analisi file → anteprima strutturata ────────────────────────────

async function handleAnalyze(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI non configurata" }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File troppo grande (max 8 MB)" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractTextFromFile(file.name, buffer);
  } catch (err) {
    if (err instanceof UnsupportedFileError) {
      return NextResponse.json({ error: err.message }, { status: 415 });
    }
    console.error("[import-quote] estrazione fallita:", err);
    return NextResponse.json(
      { error: "Impossibile leggere il file. Potrebbe essere corrotto o protetto." },
      { status: 400 }
    );
  }

  if (text.length < 30) {
    return NextResponse.json(
      {
        error:
          "Nessun testo estraibile dal file. Se è un PDF scansionato (solo immagini), esporta il preventivo in un formato testuale.",
      },
      { status: 422 }
    );
  }

  try {
    const parsed = await parseQuoteFromText(text);

    // Cerca un cliente esistente con lo stesso nome (match case-insensitive).
    let matchedClient: { id: string; name: string } | null = null;
    if (parsed.client?.name) {
      const safe = parsed.client.name.replace(/[%_]/g, "");
      const [exact] = await db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(ilike(clients.name, safe))
        .limit(1);
      matchedClient = exact ?? null;
    }

    return NextResponse.json({ parsed, matchedClient });
  } catch (err) {
    if (err instanceof QuoteParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[import-quote] analisi AI fallita:", err);
    return NextResponse.json(
      { error: "Errore durante l'analisi AI. Riprova." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quotes/import
 * - multipart/form-data con `file` → estrae il testo, lo interpreta con l'AI e
 *   restituisce l'anteprima strutturata (nessuna scrittura su DB).
 * - application/json con i dati confermati → crea preventivo + sezioni + voci.
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole("admin", "editor");
  if (error) return error;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handleAnalyze(req);
  }
  return handleCreate(req, session!.user.id);
}
