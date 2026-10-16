// Testi della mail con cui si invia un preventivo al cliente (modello
// "Lettera con riferimenti"). Condivisi tra server (invio) e client (bozza modificabile,
// anteprima): niente dipendenze da Node qui.

export type PinMode = "personal" | "attach";
export type CopyMode = "cc" | "bcc";

export const QUOTE_EMAIL_LINK_INTRO =
  "Può consultarlo e firmarlo online:";
export const QUOTE_EMAIL_CLOSING =
  "Restiamo a disposizione per qualsiasi chiarimento.";
export const QUOTE_EMAIL_REGARDS = "Cordiali saluti,";

export function quoteEmailSubject(q: { code: string; title: string; companyName: string }) {
  return `Preventivo ${q.code} · ${q.title} | ${q.companyName}`;
}

/** Saluto + introduzione: la parte del testo che si può modificare. */
export function quoteEmailMessage(q: { clientName: string | null; title: string }) {
  const name = q.clientName?.trim() || "cliente";
  return (
    `Gentile ${name},\n\n` +
    `come d'accordo, le inviamo in allegato il preventivo per «${q.title}».`
  );
}

export function quoteEmailPinLine(mode: PinMode, pin?: string | null) {
  if (mode === "attach" && pin) return `Codice di accesso: ${formatPin(pin)}`;
  return "Il codice di accesso le verrà comunicato personalmente.";
}

/** 482913 → "482 913", più facile da leggere e dettare. */
export function formatPin(pin: string) {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
}

export type QuoteEmailContent = {
  message: string;
  notes: string | null;
  /** total già formattato, es. "3.940,60 € (IVA inclusa)". */
  quote: { code: string; title: string; total: string };
  /** null = preventivo già chiuso: niente link, solo PDF. */
  link: { url: string; expiresLabel: string; pinLine: string } | null;
  signature: { senderName: string; companyName: string };
  company: {
    address: string | null;
    phone: string | null;
    email: string;
    website: string | null;
    vatNumber: string | null;
  };
};

export const QUOTE_EMAIL_CONFIDENTIALITY =
  "Questa email e i suoi allegati sono riservati al destinatario. Se l'ha ricevuta per errore, la preghiamo di avvisarci e di cancellarla.";

/** Versione solo testo (riserva per i client che non mostrano l'HTML). */
export function quoteEmailPlainText(c: QuoteEmailContent) {
  const parts = [
    c.message.trim(),
    `Preventivo   ${c.quote.code}\nLavori       ${c.quote.title}\nTotale       ${c.quote.total}`,
  ];
  if (c.link)
    parts.push(
      `${QUOTE_EMAIL_LINK_INTRO}\n${c.link.url}\n(valido fino al ${c.link.expiresLabel})`,
      c.link.pinLine
    );
  if (c.notes?.trim()) parts.push(c.notes.trim());
  parts.push(
    QUOTE_EMAIL_CLOSING,
    [QUOTE_EMAIL_REGARDS, c.signature.senderName, c.signature.companyName].join("\n"),
    [
      "—",
      c.signature.companyName,
      c.company.address,
      [c.company.phone && `Tel. ${c.company.phone}`, c.company.email].filter(Boolean).join(" · "),
      c.company.website,
      c.company.vatNumber && `P.IVA ${c.company.vatNumber}`,
    ]
      .filter(Boolean)
      .join("\n")
  );
  return parts.join("\n\n");
}
