import "server-only";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";

// ─────────────────────────────────────────────────────────────────────────────
// Posizione del cantiere sulla mappa.
//
// Le coordinate le dà OpenStreetMap (Nominatim, gratuito): un modello
// linguistico da solo le inventerebbe. L'IA entra solo se l'indirizzo così
// com'è non viene trovato: lo ripulisce ("via roma 12 moncalieri" →
// "Via Roma 12, 10024 Moncalieri TO") e si riprova. Il risultato si salva una
// volta sola nel cantiere: nessuna ricerca ripetuta.
// Regole d'uso di Nominatim: max 1 richiesta al secondo, User-Agent esplicito.
// ─────────────────────────────────────────────────────────────────────────────

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "DieffePreventivi/4.0 (+https://impresadieffe.it)";

let lastCall = 0;
async function politeDelay() {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/** Zona di lavoro dell'impresa (Piemonte): gli indirizzi senza comune
 *  ("Via Moncenisio 1") si cercano prima qui, non nel resto d'Italia. */
const HOME_VIEWBOX = "6.6,46.5,9.3,44.0";

async function nominatim(query: string, bounded = false): Promise<{ lat: number; lng: number } | null> {
  await politeDelay();
  const area = bounded ? `&viewbox=${HOME_VIEWBOX}&bounded=1` : "";
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=it&addressdetails=0${area}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "it" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data[0]) return null;
    const lat = Number(data[0].lat), lng = Number(data[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

async function normalizeWithAi(address: string, hint: string | null): Promise<string[]> {
  if (!isAiConfigured()) return [];
  try {
    const out = await generateAIJson<{ queries?: string[] }>(
      `Normalizzi indirizzi italiani di cantieri edili per la geolocalizzazione.
Rispondi SOLO con JSON: {"queries": ["...", "..."]} con al massimo 2 varianti, dalla più precisa alla più generica.
Formato: "Via/Corso/Piazza Nome Civico, CAP Comune Provincia". Correggi refusi e abbreviazioni (c.so → Corso, p.zza → Piazza).
Se manca il comune, l'impresa lavora soprattutto a Moncalieri e nella provincia di Torino. Non inventare civici.`,
      JSON.stringify({ indirizzo: address, contesto: hint ?? "" }),
      8000,
      200
    );
    return (out.queries ?? []).filter((q) => typeof q === "string" && q.trim()).slice(0, 2);
  } catch {
    return [];
  }
}

export async function geocodeAddress(
  address: string,
  opts: { hint?: string | null; useAi?: boolean } = {}
): Promise<{ lat: number; lng: number } | null> {
  const clean = address.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const local = await nominatim(clean, true);
  if (local) return local;

  if (opts.useAi !== false) {
    for (const q of await normalizeWithAi(clean, opts.hint ?? null)) {
      const hit = (await nominatim(q, true)) ?? (await nominatim(q));
      if (hit) return hit;
    }
  }
  // Fuori zona (cantiere lontano) o, in ultimo, solo comune/zona.
  const anywhere = await nominatim(clean);
  if (anywhere) return anywhere;
  const tail = clean.split(",").slice(1).join(",").trim();
  return tail ? nominatim(tail, true) : null;
}
