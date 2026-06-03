import Groq from 'groq-sdk';
import { env } from '../env';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export function isAiConfigured() {
  return !!env.GROQ_API_KEY;
}

const MODEL_FAST = 'llama-3.3-70b-versatile';
const MODEL_CHAT = 'compound-beta'; // agentic model with web search

export async function generateAI(prompt: string, timeoutMs = 8000): Promise<string> {
  const response = await Promise.race([
    groq.chat.completions.create({
      model: MODEL_FAST,
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

const CONSTRUCTION_SYSTEM_PROMPT = `Sei un assistente AI specializzato nell'edilizia italiana, consulente esperto per Dieffe Ristrutturazioni (Moncalieri, Torino).

HAI ACCESSO AI DATI REALI AZIENDALI: preventivi storici, clienti, prezzi applicati, listino prezzi.
Quando ti vengono forniti dati dei preventivi o del listino, usali come fonte primaria e cita i valori esatti.
Se l'utente chiede "quanto ho fatto pagare X?" o "l'ultima volta che ho fatto Y?", rispondi con i dati reali forniti nel contesto.

Competenze aggiuntive:
- Prezzi correnti di materiali da costruzione (puoi cercare online se necessario)
- Tecniche costruttive: ristrutturazioni, cappotto termico, impermeabilizzazioni, impianti
- Normative italiane: DM, UNI, CEI, Superbonus, Ecobonus, CILA, SCIA
- Prezzari regionali Piemonte, calcolo materiali, manodopera

Regole:
- Rispondi sempre in italiano, conciso e diretto
- Quando usi dati aziendali reali, dì "nei tuoi preventivi..." o "nel tuo listino..."
- Quando citi prezzi di mercato generici (non tuoi), aggiungi "(indicativo, verifica con fornitori)"
- Usa elenchi puntati quando appropriato`;

export async function generateAIChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  dbContext: string,
  timeoutMs = 20000
): Promise<string> {
  const systemWithContext = dbContext
    ? `${CONSTRUCTION_SYSTEM_PROMPT}\n\n${dbContext}`
    : CONSTRUCTION_SYSTEM_PROMPT;

  const response = await Promise.race([
    groq.chat.completions.create({
      model: MODEL_CHAT,
      messages: [
        { role: 'system', content: systemWithContext },
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
