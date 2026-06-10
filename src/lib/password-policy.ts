// ─────────────────────────────────────────────────────────────────────────────
// Password policy condivisa — unica fonte di verità usata sia lato server
// (validazione nelle route) sia lato client (form + indicatore robustezza).
// Logica pura: nessun import di DB/Next, sicura da usare ovunque.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordCheck {
  valid: boolean;
  errors: string[];
}

/**
 * Requisiti minimi obbligatori. Volutamente ragionevoli (non frustranti) per
 * un gestionale aziendale: lunghezza minima + almeno una lettera e un numero.
 */
export function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = [];
  if (pw.length < PASSWORD_MIN_LENGTH)
    errors.push(`Almeno ${PASSWORD_MIN_LENGTH} caratteri`);
  if (pw.length > PASSWORD_MAX_LENGTH)
    errors.push(`Massimo ${PASSWORD_MAX_LENGTH} caratteri`);
  if (!/[a-zA-Z]/.test(pw)) errors.push("Almeno una lettera");
  if (!/[0-9]/.test(pw)) errors.push("Almeno un numero");
  return { valid: errors.length === 0, errors };
}

/** Schema Zod riusabile per i campi password nelle route e nei form. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Almeno ${PASSWORD_MIN_LENGTH} caratteri`)
  .max(PASSWORD_MAX_LENGTH, `Massimo ${PASSWORD_MAX_LENGTH} caratteri`)
  .regex(/[a-zA-Z]/, "Almeno una lettera")
  .regex(/[0-9]/, "Almeno un numero");

// ─── Robustezza (per l'indicatore visivo) ──────────────────────────────────────

export type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  /** Punteggio 0-4 per riempire la barra. */
  score: 0 | 1 | 2 | 3 | 4;
  level: StrengthLevel;
  label: string;
}

const LEVEL_LABEL: Record<StrengthLevel, string> = {
  empty: "",
  weak: "Debole",
  fair: "Sufficiente",
  good: "Buona",
  strong: "Forte",
};

/**
 * Stima euristica della robustezza per il feedback in tempo reale.
 * Premia lunghezza, varietà di classi di caratteri e penalizza pattern banali.
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, level: "empty", label: "" };

  let points = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) points++;
  if (pw.length >= 12) points++;
  if (pw.length >= 16) points++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points++;
  if (/[0-9]/.test(pw)) points++;
  if (/[^a-zA-Z0-9]/.test(pw)) points++;

  // Penalità per pattern molto comuni o ripetizioni.
  if (/^(.)\1+$/.test(pw)) points -= 2; // tutti caratteri uguali
  if (/^(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|password|admin)/i.test(pw))
    points -= 2;

  const score = Math.max(0, Math.min(points, 5));

  let level: StrengthLevel;
  let bar: 0 | 1 | 2 | 3 | 4;
  if (score <= 1) {
    level = "weak";
    bar = 1;
  } else if (score === 2) {
    level = "fair";
    bar = 2;
  } else if (score === 3 || score === 4) {
    level = "good";
    bar = 3;
  } else {
    level = "strong";
    bar = 4;
  }

  return { score: bar, level, label: LEVEL_LABEL[level] };
}

// ─── Generatore di password sicura (per il reset admin) ─────────────────────────

/**
 * Genera una password robusta e leggibile (esclude caratteri ambigui come
 * 0/O, 1/l/I) garantendo almeno una lettera minuscola, una maiuscola, una cifra
 * e un simbolo. Usa crypto del browser/Node se disponibile, altrimenti Math.random.
 */
export function generateStrongPassword(length = 16): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%&*?-_+=";
  const all = lower + upper + digits + symbols;

  const randInt = (max: number): number => {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      const arr = new Uint32Array(1);
      globalThis.crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  const pick = (set: string) => set[randInt(set.length)];

  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  for (let i = chars.length; i < length; i++) chars.push(pick(all));

  // Mescola (Fisher-Yates) così i caratteri garantiti non restano in testa.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
