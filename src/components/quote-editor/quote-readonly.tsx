"use client";

import { createContext, useContext } from "react";

/**
 * Preventivo in sola lettura perché bloccato (B1). Dentro l'editor
 * `usePermissions()` lo tratta come un utente "viewer": tutti i campi e i tasti
 * di modifica si disattivano senza toccare ogni componente.
 */
export const QuoteReadOnlyContext = createContext(false);

export function useQuoteReadOnly() {
  return useContext(QuoteReadOnlyContext);
}
