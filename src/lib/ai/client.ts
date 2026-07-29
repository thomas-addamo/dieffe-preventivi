import Groq from 'groq-sdk';
import { env } from '../env';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export function isAiConfigured() {
  return !!env.GROQ_API_KEY;
}

// Llama 3.3 70B ha solo 100K token/giorno sul piano Groq Free ed è in
// dismissione. Separiamo i carichi su modelli con 200K TPD e ruotiamo
// automaticamente quando un modello raggiunge quota o non è disponibile.
const MODEL_FAST = 'openai/gpt-oss-20b';
const MODEL_CHAT = 'openai/gpt-oss-120b';
const MODEL_FALLBACK = 'qwen/qwen3.6-27b';
const MODEL_CHAT_WEB = 'groq/compound-mini';

const MODELS_FAST = [MODEL_FAST, MODEL_FALLBACK, MODEL_CHAT] as const;
const MODELS_CHAT = [MODEL_CHAT, MODEL_FALLBACK, MODEL_FAST] as const;
const MODELS_CHAT_WEB = [MODEL_CHAT_WEB, ...MODELS_CHAT] as const;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type CompleteOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  json?: boolean;
};

type AiError = Error & {
  status?: number;
  code?: string;
};

class EmptyAiResponseError extends Error {
  constructor(model: string) {
    super(`Risposta vuota dal modello ${model}`);
    this.name = 'EmptyAiResponseError';
  }
}

function reasoningOptions(model: string) {
  if (model.startsWith('openai/gpt-oss-')) {
    return {
      reasoning_effort: 'low' as const,
      reasoning_format: 'hidden' as const,
    };
  }

  if (model.startsWith('qwen/')) {
    return {
      reasoning_effort: 'none' as const,
      reasoning_format: 'hidden' as const,
    };
  }

  return {};
}

function shouldTryFallback(error: unknown) {
  if (error instanceof EmptyAiResponseError) return true;

  const e = error as AiError;
  if (!e.status || e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500) {
    return true;
  }

  // Groq può restituire 400/404 quando un model ID viene ritirato.
  const message = e.message?.toLowerCase() ?? '';
  return (
    e.status === 404 ||
    message.includes('decommission') ||
    message.includes('deprecated') ||
    message.includes('model_not_found')
  );
}

function logFallback(error: unknown, model: string, fallbackModel: string) {
  const e = error as AiError;
  console.warn(
    JSON.stringify({
      level: 'warning',
      msg: 'ai_model_fallback',
      model,
      fallbackModel,
      status: e.status ?? null,
      code: e.code ?? null,
      reason: (e.message ?? String(error)).slice(0, 180),
    })
  );
}

/**
 * Chiamata Groq con rotazione automatica dei modelli in caso di quota,
 * timeout, errore temporaneo o dismissione. Il timeout dell'SDK interrompe
 * davvero la richiesta, evitando che continui a consumare token in background.
 */
async function complete(
  models: readonly string[],
  messages: ChatMessage[],
  opts: CompleteOptions = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 1024, timeoutMs = 12000, json = false } = opts;

  let lastError: unknown;
  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    try {
      const response = await groq.chat.completions.create(
        {
          model,
          messages,
          temperature,
          max_completion_tokens: maxTokens,
          stream: false,
          ...reasoningOptions(model),
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
        },
        {
          timeout: timeoutMs,
          // La rotazione qui gestisce i retry senza insistere sul modello
          // che ha già esaurito la propria quota giornaliera.
          maxRetries: 0,
        }
      );

      const content = response.choices[0]?.message?.content?.trim() ?? '';
      if (!content) throw new EmptyAiResponseError(model);
      return content;
    } catch (error) {
      lastError = error;
      const fallbackModel = models[index + 1];
      if (!fallbackModel || !shouldTryFallback(error)) throw error;
      logFallback(error, model, fallbackModel);
    }
  }

  throw lastError ?? new Error('Nessun modello AI disponibile');
}

export async function generateAI(prompt: string, timeoutMs = 10000): Promise<string> {
  return complete(MODELS_FAST, [{ role: 'user', content: prompt }], {
    temperature: 0.5,
    maxTokens: 1024,
    timeoutMs,
  });
}

/**
 * Genera output JSON in modo robusto: forza response_format json, temperatura
 * bassa e ruota sui modelli di riserva in caso di errore temporaneo o quota.
 * Lancia se nessun modello riesce a produrre JSON valido.
 */
export async function generateAIJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 11000,
  maxTokens = 900
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const raw = await complete(MODELS_FAST, messages, {
    temperature: 0.2,
    maxTokens,
    timeoutMs,
    json: true,
  });

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
    // Sei turni completi sono sufficienti per la continuità e impediscono che
    // chat lunghe esauriscano rapidamente i limiti TPM/TPD del provider.
    ...messages.slice(-12),
  ];

  return complete(opts.web ? MODELS_CHAT_WEB : MODELS_CHAT, fullMessages, {
    temperature: 0.6,
    maxTokens: 1500,
    // Quattro tentativi web da 10s restano entro i 45s della funzione Vercel.
    timeoutMs: 10000,
  });
}
