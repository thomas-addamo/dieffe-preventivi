import { randomUUID, createHash, timingSafeEqual } from "crypto";

export function generatePublicToken(): string {
  return randomUUID();
}

export function computeExpiresAt(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Pepper per l'hash del PIN. SESSION_SECRET è la variabile reale in .env;
// BETTER_AUTH_SECRET e stringa vuota restano come fallback legacy per i PIN
// generati prima di questo fix.
const PIN_PEPPER = process.env.SESSION_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "";
const LEGACY_PEPPERS = [process.env.BETTER_AUTH_SECRET ?? "", ""];

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export function hashPin(pin: string): string {
  return sha256(pin + PIN_PEPPER);
}

export function verifyPin(pin: string, hash: string): boolean {
  if (safeEqualHex(sha256(pin + PIN_PEPPER), hash)) return true;
  // Compatibilità con PIN salvati prima dell'introduzione del pepper corretto.
  return LEGACY_PEPPERS.some(
    (pepper) => pepper !== PIN_PEPPER && safeEqualHex(sha256(pin + pepper), hash)
  );
}

export function isTokenValid(
  token: string | null,
  expiresAt: Date | null,
  quoteStatus: string
): { valid: boolean; reason?: "not_generated" | "expired" | "closed" } {
  if (!token || !expiresAt) return { valid: false, reason: "not_generated" };
  if (new Date() > expiresAt) return { valid: false, reason: "expired" };
  if (["accepted", "rejected"].includes(quoteStatus))
    return { valid: false, reason: "closed" };
  return { valid: true };
}
