import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { geminiFlash } from '@/lib/ai/gemini';
import { z } from 'zod';
import { env } from '@/lib/env';

const schema = z.object({
  description: z.string().min(3).max(500),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  if (!env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI non configurata' }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input non valido' }, { status: 400 });

  const { description } = parsed.data;

  const prompt = `Sei un assistente per un'impresa di ristrutturazioni edili italiana.

Riscrivi questa descrizione di una voce di preventivo in modo:
- Grammaticalmente corretto
- Professionale e tecnico
- Chiaro e comprensibile per il cliente
- Mantieni lo stesso significato dell'originale
- Usa terminologia edilizia italiana corretta
- Lunghezza simile all'originale (non accorciare troppo)

Descrizione originale: "${description}"

Rispondi SOLO con la descrizione migliorata, nessun altro testo.`;

  try {
    const result = await Promise.race([
      geminiFlash.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);

    const improvedDescription = (
      result as Awaited<ReturnType<typeof geminiFlash.generateContent>>
    ).response
      .text()
      .trim()
      .replace(/^["']|["']$/g, '');

    return NextResponse.json({ improvedDescription });
  } catch {
    return NextResponse.json({ error: 'Errore AI. Riprova.' }, { status: 500 });
  }
}
