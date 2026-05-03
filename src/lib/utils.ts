import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: it });
  } catch {
    return dateStr;
  }
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateExportFilename(
  code: string,
  title: string,
  ext: string
): string {
  const date = format(new Date(), "yyyy-MM-dd");
  return `${code}_${slugify(title)}_${date}.${ext}`;
}

export const UNIT_OF_MEASURES = [
  "mq",
  "ml",
  "mc",
  "kg",
  "n°",
  "h",
  "a corpo",
  "vs.carico",
] as const;

export type UnitOfMeasure = (typeof UNIT_OF_MEASURES)[number] | string;

export const PAYMENT_TERMS_TEMPLATES = [
  "30% all'accettazione del preventivo, 40% a metà lavori, 30% alla consegna",
  "50% inizio lavori, 50% fine lavori",
  "20% inizio lavori, 30% al primo SAL, 30% al secondo SAL, 20% fine lavori",
  "Pagamento in un'unica soluzione alla consegna",
  "Bonifico bancario a 30 giorni dalla fattura",
];

export const VAT_RATES = [0, 4, 10, 22] as const;

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  archived: "Archiviato",
};

export const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-stone-100 text-stone-600",
};
