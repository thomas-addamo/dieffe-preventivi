import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";

// Richiesta d'aiuto all'amministratore: arriva come notifica (campanella e
// push) a tutti gli admin. Non si crea nessuna tabella: è una notifica.

const schema = z.object({
  topic: z.enum(["problema", "domanda", "funzione", "altro"]),
  message: z.string().trim().min(5).max(1500),
  page: z.string().max(200).optional(),
});

const TOPIC: Record<z.infer<typeof schema>["topic"], string> = {
  problema: "Problema",
  domanda: "Domanda",
  funzione: "Nuova funzione",
  altro: "Richiesta",
};

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Scrivi almeno qualche parola" }, { status: 400 });

  const { topic, message, page } = parsed.data;
  await notifyAdmins({
    type: "support",
    title: `${TOPIC[topic]} da ${session.user.name}`,
    body: `${message}${page ? `\n\nPagina: ${page}` : ""}\nRispondi a: ${session.user.email}`,
    link: page && page.startsWith("/") ? page : null,
  });
  return NextResponse.json({ ok: true });
}
