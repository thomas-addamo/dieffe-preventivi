import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/permissions/guard";
import { aiDisabledResponse } from "@/lib/ai/guard";
import { generateAIText, isAiConfigured } from "@/lib/ai/client";

// Controllo ortografico e grammaticale di un testo destinato al cliente
// (note della mail del preventivo). Corregge soltanto: niente riscritture di
// tono o contenuto. Restituisce il testo corretto e l'elenco delle modifiche,
// che l'utente conferma prima di applicarle. Nessuna scrittura nel database.

const schema = z.object({ text: z.string().trim().min(2).max(5000) });

const SYSTEM = `Sei un correttore di bozze italiano per un'impresa edile.
Correggi SOLO errori di ortografia, grammatica (inclusi congiuntivi, concordanze e tempi verbali), punteggiatura, accenti, apostrofi e maiuscole.
Non cambiare il tono, il registro (Lei/tu), il significato, l'ordine delle frasi né la terminologia tecnica.
Non aggiungere né togliere contenuti. Mantieni gli a capo originali.
Se il testo è già corretto restituiscilo identico.
Rispondi SOLO con il testo corretto: niente commenti, virgolette o spiegazioni.`;

type Change = { from: string; to: string };

/** Differenze parola per parola (LCS) tra originale e testo corretto: l'elenco
 *  delle modifiche lo calcoliamo noi, non lo chiediamo all'AI (inaffidabile). */
function diffWords(a: string, b: string): Change[] {
  const x = a.split(/\s+/).filter(Boolean);
  const y = b.split(/\s+/).filter(Boolean);
  const n = x.length;
  const m = y.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Change[] = [];
  let i = 0;
  let j = 0;
  let from: string[] = [];
  let to: string[] = [];
  const flush = () => {
    if (from.length || to.length) out.push({ from: from.join(" ") || "—", to: to.join(" ") || "—" });
    from = [];
    to = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      flush();
      i++;
      j++;
    } else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) to.push(y[j++]);
    else from.push(x[i++]);
  }
  flush();
  return out;
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole("admin", "editor");
  if (error) return error;
  const aiOff = await aiDisabledResponse();
  if (aiOff) return aiOff;
  if (!isAiConfigured()) return NextResponse.json({ error: "AI non configurata" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Testo non valido" }, { status: 400 });
  const { text } = parsed.data;

  try {
    const out = await generateAIText(SYSTEM, text, { maxTokens: Math.min(6000, 1500 + text.length) });
    const corrected =
      out
        .trim()
        .replace(/^["«“]([\s\S]*)["»”]$/, "$1")
        .split("\n")
        .map((l) => l.trimEnd())
        .join("\n")
        .trim() || text;
    const changes = corrected === text ? [] : diffWords(text, corrected).slice(0, 50);
    return NextResponse.json({ corrected: changes.length ? corrected : text, changes });
  } catch (err) {
    console.error("[AI proofread]", err instanceof Error ? err.message.slice(0, 200) : err);
    return NextResponse.json({ error: "Controllo non riuscito. Riprova." }, { status: 500 });
  }
}
