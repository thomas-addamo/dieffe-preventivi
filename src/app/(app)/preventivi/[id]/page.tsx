import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { clients, quotes } from "@/lib/db/schema";
import { QuoteEditor } from "@/components/quote-editor/QuoteEditor";
import { and, asc, eq, isNull } from "drizzle-orm";
import { sitesEnabledFor } from "@/lib/features";
import { getQuoteSite } from "@/lib/sites/quote-site";
import { countSurveyBoard } from "@/lib/sites/survey-board";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuotePage({ params }: Props) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const { id } = await params;
  const quote = await getQuoteWithRelations(id);
  if (!quote) notFound();

  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .orderBy(clients.name);

  // Lavori extra: il preventivo principale (se questo è un extra) e gli extra collegati.
  const rootId = quote.kind === "extra" ? quote.parentQuoteId : quote.id;
  const [parent, extras, site, surveyCount] = await Promise.all([
    quote.kind === "extra" && quote.parentQuoteId
      ? db
          .select({ id: quotes.id, code: quotes.code, title: quotes.title })
          .from(quotes)
          .where(eq(quotes.id, quote.parentQuoteId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    rootId
      ? db
          .select({ id: quotes.id, code: quotes.code, title: quotes.title, status: quotes.status })
          .from(quotes)
          .where(and(eq(quotes.parentQuoteId, rootId), isNull(quotes.deletedAt)))
          .orderBy(asc(quotes.createdAt))
      : Promise.resolve([]),
    // Cantiere collegato: una lettura per chiave primaria (solo se la funzione è attiva).
    sitesEnabledFor(session.user.role) ? getQuoteSite(id).then((r) => r.site) : Promise.resolve(undefined),
    // Note e foto del sopralluogo: il numero sul tasto del pannello.
    countSurveyBoard(id, quote.siteId ?? null),
  ]);

  return (
    <QuoteEditor
      initialQuote={quote}
      clients={allClients}
      related={{ parent, extras }}
      site={site}
      surveyCount={surveyCount}
      currentUser={{ id: session.user.id, name: session.user.name }}
    />
  );
}
