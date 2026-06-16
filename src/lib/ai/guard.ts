import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { companySettings } from "@/lib/db/schema";

/**
 * Interruttore generale dell'AI (org-wide), controllato dall'admin nelle
 * Impostazioni. Ritorna una risposta 403 se l'AI è disattivata, altrimenti
 * `null` (si prosegue). In caso di errore lettura, lascia passare.
 */
export async function aiDisabledResponse(): Promise<NextResponse | null> {
  try {
    const [s] = await db
      .select({ aiEnabled: companySettings.aiEnabled })
      .from(companySettings)
      .limit(1);
    if (s && !s.aiEnabled) {
      return NextResponse.json(
        { error: "L'assistente AI è disattivato dall'amministratore." },
        { status: 403 }
      );
    }
  } catch {
    /* in dubbio, non bloccare */
  }
  return null;
}
