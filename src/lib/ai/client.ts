import Groq from 'groq-sdk';
import { env } from '../env';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export function isAiConfigured() {
  return !!env.GROQ_API_KEY;
}

// Modello veloce e stabile per task strutturati (prezzi, descrizioni, learn).
const MODEL_FAST = 'llama-3.3-70b-versatile';
// Modello chat principale: stabile. compound-beta resta come "potenziamento"
// opzionale (ricerca web) ma NON come default perché va spesso in rate-limit
// sulle richieste consecutive → era la causa del "secondo messaggio dà errore".
const MODEL_CHAT = 'llama-3.3-70b-versatile';
const MODEL_CHAT_WEB = 'compound-beta';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Chiamata Groq con un fallback automatico su un secondo modello se il primo
 * fallisce (rate-limit/timeout/decommissionato). Restituisce sempre testo.
 */
async function complete(
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number; json?: boolean } = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 1024, timeoutMs = 12000, json = false } = opts;

  const response = await Promise.race([
    groq.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    ),
  ]);

  return response.choices[0]?.message?.content ?? '';
}

export async function generateAI(prompt: string, timeoutMs = 10000): Promise<string> {
  return complete(MODEL_FAST, [{ role: 'user', content: prompt }], {
    temperature: 0.5,
    maxTokens: 1024,
    timeoutMs,
  });
}

/**
 * Genera output JSON in modo robusto: forza response_format json, temperatura
 * bassa, e ritenta una volta sul modello veloce in caso di errore. Lancia se
 * non riesce a produrre JSON valido (il chiamante gestisce il fallback).
 */
export async function generateAIJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 11000
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let raw = '';
  try {
    raw = await complete(MODEL_FAST, messages, {
      temperature: 0.2,
      maxTokens: 900,
      timeoutMs,
      json: true,
    });
  } catch {
    // Un solo retry, senza json mode (alcuni edge case di rate-limit).
    raw = await complete(MODEL_FAST, messages, {
      temperature: 0.2,
      maxTokens: 900,
      timeoutMs,
    });
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON non trovato nella risposta AI');
  return JSON.parse(match[0]) as T;
}

const CONSTRUCTION_SYSTEM_PROMPT = `Sei un assistente AI esperto di edilizia italiana, consulente per Dieffe Ristrutturazioni (Moncalieri, Torino).

HAI ACCESSO AI DATI REALI AZIENDALI: preventivi storici, clienti, prezzi applicati, listino prezzi.
Quando ti vengono forniti dati dei preventivi o del listino nel contesto, usali come FONTE PRIMARIA e cita i valori esatti (prezzi, date, clienti).
Se l'utente chiede "quanto ho fatto pagare X?" o "l'ultima volta che ho fatto Y?", rispondi con i dati reali forniti nel contesto.

Competenze:
- Prezzi correnti materiali da costruzione (mercato italiano/Piemonte)
- Tecniche: ristrutturazioni, cappotto termico, impermeabilizzazioni, impianti, massetti, posa
- Normative: DM, UNI, CEI, Superbonus, Ecobonus, CILA, SCIA
- Calcolo materiali, manodopera, computo metrico

Regole:
- Rispondi sempre in italiano, conciso e diretto (max 4-6 righe salvo richiesta esplicita)
- Quando usi dati aziendali reali, dì "nei tuoi preventivi..." o "nel tuo listino..."
- Quando citi prezzi di mercato generici (non tuoi), aggiungi "(indicativo, verifica con fornitori)"
- Usa elenchi puntati quando aiutano la chiarezza
- Non inventare dati: se non hai il dato nel contesto, dillo e dai una stima di mercato segnalandola come tale`;

export async function generateAIChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  dbContext: string,
  opts: { web?: boolean } = {}
): Promise<string> {
  const systemWithContext = dbContext
    ? `${CONSTRUCTION_SYSTEM_PROMPT}\n\n=== CONTESTO DATI AZIENDALI ===${dbContext}`
    : CONSTRUCTION_SYSTEM_PROMPT;

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemWithContext },
    ...messages,
  ];

  // Modello primario stabile. Se l'utente chiede esplicitamente la ricerca web
  // si usa compound-beta, ma con fallback automatico al modello stabile.
  const primary = opts.web ? MODEL_CHAT_WEB : MODEL_CHAT;
  try {
    return await complete(primary, fullMessages, {
      temperature: 0.6,
      maxTokens: 1500,
      timeoutMs: opts.web ? 22000 : 15000,
    });
  } catch (err) {
    if (primary === MODEL_CHAT) throw err;
    // Fallback: web fallito → riprova sul modello stabile.
    return complete(MODEL_CHAT, fullMessages, {
      temperature: 0.6,
      maxTokens: 1500,
      timeoutMs: 15000,
    });
  }
}
