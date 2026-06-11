// ─────────────────────────────────────────────────────────────────────────────
// Estrazione testo grezzo da file di preventivo (PDF, DOCX, Excel, CSV, TXT).
// Restituisce testo piatto pronto per l'analisi AI. Nessun accesso DB.
// ─────────────────────────────────────────────────────────────────────────────

/** Limite caratteri per non sforare il context window del modello. */
export const MAX_TEXT_LENGTH = 28000;

export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
] as const;

export class UnsupportedFileError extends Error {
  constructor(filename: string) {
    super(
      `Formato non supportato: "${filename}". Formati accettati: ${SUPPORTED_EXTENSIONS.join(", ")}`
    );
    this.name = "UnsupportedFileError";
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractExcel(buffer: Buffer): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const lines: string[] = [];
  for (const sheet of workbook.worksheets) {
    if (workbook.worksheets.length > 1) lines.push(`=== Foglio: ${sheet.name} ===`);
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        // .text risolve formule e date in stringa leggibile
        cells.push(String(cell.text ?? "").trim());
      });
      const line = cells.join("\t").replace(/\t+$/, "");
      if (line.trim()) lines.push(line);
    });
  }
  return lines.join("\n");
}

/**
 * Estrae il testo da un file caricato. Lancia UnsupportedFileError per formati
 * sconosciuti, Error generico se il parsing fallisce.
 */
export async function extractTextFromFile(
  filename: string,
  buffer: Buffer
): Promise<string> {
  const lower = filename.toLowerCase();

  let text: string;
  if (lower.endsWith(".pdf")) {
    text = await extractPdf(buffer);
  } else if (lower.endsWith(".docx")) {
    text = await extractDocx(buffer);
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    text = await extractExcel(buffer);
  } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    text = buffer.toString("utf-8");
  } else {
    throw new UnsupportedFileError(filename);
  }

  // Normalizza spazi e tronca per il prompt AI.
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  return clean.length > MAX_TEXT_LENGTH
    ? clean.slice(0, MAX_TEXT_LENGTH) + "\n[... testo troncato ...]"
    : clean;
}
