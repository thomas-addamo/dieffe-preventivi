import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createQuote } from "@/lib/db/quotes";

export default async function NuovoPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  // create a blank quote and redirect to its editor
  const id = await createQuote(session.user.id, {
    title: "Nuovo preventivo",
  });

  redirect(`/preventivi/${id}`);
}
