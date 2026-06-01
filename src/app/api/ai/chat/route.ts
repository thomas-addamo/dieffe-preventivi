import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { generateAIChat, isAiConfigured } from '@/lib/ai/client';
import { z } from 'zod';

const schema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(2000),
    })
  ).min(1).max(30),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI non configurata' }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input non valido' }, { status: 400 });

  try {
    const reply = await generateAIChat(parsed.data.messages);
    return NextResponse.json({ reply });
  } catch (err) {
    const e = err as { message?: string; status?: number };
    console.error('[AI Chat] status=' + (e.status ?? '?') + ' msg=' + (e.message ?? String(err)).slice(0, 200));
    return NextResponse.json({ error: 'Errore AI. Riprova.' }, { status: 500 });
  }
}
