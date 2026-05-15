import { randomUUID } from "crypto";

export function generatePublicToken(): string {
  return randomUUID();
}

export function computeExpiresAt(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
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
