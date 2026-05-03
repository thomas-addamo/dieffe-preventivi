import type { QuoteWithRelations } from "@/types";
import { formatDate } from "@/lib/utils";

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(quote: QuoteWithRelations): string {
  const headers = [
    "Codice Preventivo",
    "Data",
    "Cliente",
    "Sezione Codice",
    "Sezione Titolo",
    "N. Voce",
    "Descrizione",
    "U.M.",
    "Quantità",
    "Prezzo Unitario",
    "Sconto %",
    "Totale Voce",
    "Note",
  ];

  const rows: string[][] = [headers];

  for (const section of quote.sections) {
    for (let idx = 0; idx < section.items.length; idx++) {
      const item = section.items[idx];
      rows.push([
        quote.code,
        formatDate(quote.createdAt),
        quote.client?.name ?? "",
        section.code,
        section.title,
        `${section.code}.${idx + 1}`,
        item.description,
        item.unitOfMeasure,
        String(item.quantity),
        String(item.unitPrice),
        String(item.discount),
        String(item.total),
        item.notes ?? "",
      ]);
    }
  }

  return rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
}
