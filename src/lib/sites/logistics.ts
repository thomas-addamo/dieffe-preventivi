// Logistica di cantiere: com'è l'accesso, visto al sopralluogo. Si salva come
// numero (quotes.site_logistics, 1–4) e si mostra con queste etichette su sito,
// app Mac e iPhone (ios/Dieffe/Native/Survey/SiteLogistics.swift ha le stesse).

export const SITE_LOGISTICS = [
  {
    level: 1,
    title: "Semplice",
    detail: "Cortile raggiungibile comodamente dal passo carraio: si può montare il montacarico ed entrare con il camion con gru.",
  },
  {
    level: 2,
    title: "Intermedia",
    detail: "Si arriva al cortile interno con una o più manovre.",
  },
  {
    level: 3,
    title: "Difficile",
    detail: "Accesso solo con mezzi di piccole dimensioni.",
  },
  {
    level: 4,
    title: "Accesso impossibile",
    detail: "Serve il permesso di occupazione del suolo pubblico.",
  },
] as const;

export type SiteLogisticsLevel = (typeof SITE_LOGISTICS)[number]["level"];

export function logisticsInfo(level: number | null | undefined) {
  return SITE_LOGISTICS.find((l) => l.level === level) ?? null;
}

export function isLogisticsLevel(v: unknown): v is SiteLogisticsLevel {
  return v === 1 || v === 2 || v === 3 || v === 4;
}
