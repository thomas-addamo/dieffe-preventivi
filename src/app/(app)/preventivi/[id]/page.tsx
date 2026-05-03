import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { QuoteEditor } from "@/components/quote-editor/QuoteEditor";

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

  return <QuoteEditor initialQuote={quote} clients={allClients} />;
}
