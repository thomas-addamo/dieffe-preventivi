import Groq from 'groq-sdk';
import { env } from '../env';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export function isAiConfigured() {
  return !!env.GROQ_API_KEY;
}

const MODEL = 'llama-3.3-70b-versatile';

export async function generateAI(prompt: string, timeoutMs = 8000): Promise<string> {
  const response = await Promise.race([
    groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    ),
  ]);

  return response.choices[0]?.message?.content ?? '';
}

const CONSTRUCTION_SYSTEM_PROMPT = `Sei un assistente AI specializzato nell'edilizia italiana, consulente per imprese di ristrutturazione.

Competenze:
- Prezzi indicativi di materiali da costruzione (dati 2024, variabili per zona/fornitore)
- Tecniche costruttive: ristrutturazioni, cappotto termico, impermeabilizzazioni, impianti idrotermici ed elettrici
- Normative edilizie italiane: DM, UNI, CEI, Superbonus, Ecobonus, bonus facciate
- Preventivi: calcolo quantità materiali, rendimenti, manodopera, prezzari regionali
- Materiali: calcestruzzo, laterizi, isolanti, impermeabilizzanti, rivestimenti, serramenti

Rispondi sempre in italiano, in modo professionale e conciso.
Quando citi prezzi, aggiungi sempre "(prezzo indicativo 2024, verifica con fornitori locali)".
Usa elenchi puntati quando appropriato. Sii diretto e pratico.`;

export async function generateAIChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  timeoutMs = 15000
): Promise<string> {
  const response = await Promise.race([
    groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: CONSTRUCTION_SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1500,
      stream: false,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    ),
  ]);

  return response.choices[0]?.message?.content ?? '';
}
