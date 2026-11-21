import { create } from "zustand";
import { useEffect } from "react";

// Ultimo pezzo del percorso nella barra in alto (C2): le pagine di dettaglio
// (preventivo, cantiere) lo impostano con il loro nome e stato.

export type PageCrumb = { label: string; status?: string };

export const usePageCrumbStore = create<{ crumb: PageCrumb | null; set: (c: PageCrumb | null) => void }>((set) => ({
  crumb: null,
  set: (crumb) => set({ crumb }),
}));

/** Mostra `label` (e lo stato) come ultimo pezzo del percorso finché la pagina è aperta. */
export function usePageCrumb(label: string | null | undefined, status?: string) {
  const set = usePageCrumbStore((s) => s.set);
  useEffect(() => {
    set(label ? { label, status } : null);
  }, [label, status, set]);
  useEffect(() => () => set(null), [set]);
}
