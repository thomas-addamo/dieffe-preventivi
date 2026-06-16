import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { aiDisabledResponse } from '@/lib/ai/guard';
import { generateAIChat, isAiConfigured } from '@/lib/ai/client';
import { buildSearchContext } from '@/lib/ai/rag';
import { z } from 'zod';

const schema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(3000),
    })
  ).min(1).max(30),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  const aiOff = await aiDisabledResponse();
  if (aiOff) return aiOff;

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI non configurata' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input non valido' }, { status: 400 });

  const { messages } = parsed.data;

  // Build DB context from the last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const dbContext = lastUserMsg
    ? await buildSearchContext(lastUserMsg.content).catch(() => '')
    : '';

  // Attiva la ricerca web solo quando l'utente la chiede esplicitamente:
  // così le richieste normali usano il modello stabile (niente errori a catena).
  const lastText = (lastUserMsg?.content ?? '').toLowerCase();
  const web = /\b(online|internet|web|oggi|attuale|aggiornat|ultim[oi] prezz|quanto costa adesso|prezzo di mercato)\b/.test(
    lastText
  );

  try {
    const reply = await generateAIChat(messages, dbContext, { web });
    return NextResponse.json({ reply });
  } catch (err) {
    const e = err as { message?: string; status?: number };
    console.error('[AI Chat] status=' + (e.status ?? '?') + ' msg=' + (e.message ?? String(err)).slice(0, 200));
    return NextResponse.json({ error: 'Errore AI. Riprova.' }, { status: 500 });
  }
}
