import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { clients, quotes, users } from "@/lib/db/schema";
import { QuoteEditor } from "@/components/quote-editor/QuoteEditor";
import { and, asc, eq, isNull } from "drizzle-orm";

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

  const allUsers = session.user.role === "admin"
    ? await db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name))
    : [];

  // Lavori extra: il preventivo principale (se questo è un extra) e gli extra collegati.
  const rootId = quote.kind === "extra" ? quote.parentQuoteId : quote.id;
  const [parent, extras] = await Promise.all([
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
  ]);

  return (
    <QuoteEditor
      initialQuote={quote}
      clients={allClients}
      users={allUsers}
      related={{ parent, extras }}
    />
  );
}
