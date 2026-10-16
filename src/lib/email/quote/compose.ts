import "server-only";
import React from "react";
import { render } from "@react-email/render";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { calcQuoteTotals } from "@/lib/calculations";
import { cloudinary } from "@/lib/cloudinary";
import { formatCurrency } from "@/lib/utils";
import type { QuoteWithRelations } from "@/types";
import { QuoteToClientEmail } from "../templates/quote-to-client";
import { quoteEmailPlainText, type QuoteEmailContent } from "./text";

export const DEFAULT_COMPANY_NAME = "Dieffe Ristrutturazioni";

export async function loadQuoteEmailContext(quoteId: string) {
  const [quote, [settings]] = await Promise.all([
    getQuoteWithRelations(quoteId),
    db.select().from(companySettings).limit(1),
  ]);
  if (!quote) return null;
  const totals = calcQuoteTotals(quote.sections, quote.vatRate, quote.discountType, quote.discountValue);
  return {
    quote,
    settings: settings ?? null,
    companyName: settings?.companyName?.trim() || DEFAULT_COMPANY_NAME,
    total: `${formatCurrency(totals.total)}${quote.vatRate > 0 ? " (IVA inclusa)" : ""}`,
  };
}

export type QuoteEmailContext = NonNullable<Awaited<ReturnType<typeof loadQuoteEmailContext>>>;

export function isQuoteClosed(quote: QuoteWithRelations) {
  return quote.status === "accepted" || quote.status === "rejected";
}

export function formatExpires(d: Date | string) {
  return format(new Date(d), "dd/MM/yyyy", { locale: it });
}

const clean = (v: string | null | undefined) => v?.trim() || null;

export function buildContent(
  ctx: QuoteEmailContext,
  input: {
    message: string;
    notes: string | null;
    senderName: string;
    fromAddress: string;
    link: QuoteEmailContent["link"];
  }
): QuoteEmailContent {
  return {
    message: input.message,
    notes: input.notes,
    quote: { code: ctx.quote.code, title: ctx.quote.title, total: ctx.total },
    link: input.link,
    signature: { senderName: input.senderName, companyName: ctx.companyName },
    company: {
      address: clean(ctx.settings?.address),
      phone: clean(ctx.settings?.phone),
      email: clean(ctx.settings?.email) ?? input.fromAddress,
      website: clean(ctx.settings?.website),
      vatNumber: clean(ctx.settings?.vatNumber),
    },
  };
}

export async function renderQuoteEmail(ctx: QuoteEmailContext, content: QuoteEmailContent) {
  const logoUrl = ctx.settings?.logoPath
    ? cloudinary.url(ctx.settings.logoPath, {
        fetch_format: "png",
        quality: "auto",
        height: 80,
        crop: "limit",
        secure: true,
      })
    : null;
  const html = await render(
    React.createElement(QuoteToClientEmail, {
      content,
      brandColor: ctx.settings?.primaryColor || "#1e40af",
      logoUrl,
    })
  );
  return { html, text: quoteEmailPlainText(content) };
}
