import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { aiDisabledResponse } from "@/lib/ai/guard";
import { generateAI, isAiConfigured } from "@/lib/ai/client";
import { APP_GUIDE } from "@/lib/help-guide";

// Assistente del pulsante Aiuto: risponde su come si usa l'app.

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(12),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const aiOff = await aiDisabledResponse();
  if (aiOff) return aiOff;
  if (!isAiConfigured()) return NextResponse.json({ error: "AI non configurata" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });

  const history = parsed.data.messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Utente" : "Assistente"}: ${m.content}`)
    .join("\n");

  const prompt = `Sei l'assistente di supporto di Dieffe Preventivi. Rispondi in italiano, in modo breve e pratico (max 6 righe, passi numerati se servono), SOLO su come usare l'app, basandoti sulla guida qui sotto. Se la funzione non esiste o non sei sicuro, dillo e suggerisci di scrivere all'amministratore dalla scheda "Scrivi all'amministratore". L'utente è ${session.user.name} (ruolo: ${session.user.role}).

=== GUIDA ===
${APP_GUIDE}

=== CONVERSAZIONE ===
${history}
Assistente:`;

  try {
    const answer = await generateAI(prompt, 15000);
    return NextResponse.json({ answer: answer.trim() });
  } catch {
    return NextResponse.json({ error: "L'assistente non è disponibile, riprova tra poco" }, { status: 502 });
  }
}
