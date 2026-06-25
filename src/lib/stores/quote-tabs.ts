"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Store dei "tab" dei preventivi (esperienza tipo editor VS Code) + elenco dei
// preventivi aperti di recente (usato dalla sezione "Aperti di recente" in
// Dashboard). Persistito in localStorage così i tab restano tra le navigazioni
// e tra le sessioni. Per-dispositivo (no backend), coerente con l'uso desktop.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QuoteTab {
  id: string;
  code: string;
  title: string;
}

interface RecentEntry {
  id: string;
  at: number;
}

interface QuoteTabsState {
  tabs: QuoteTab[];
  recent: RecentEntry[];
  /** Apre (o aggiorna) un tab. Non riordina i tab già presenti. */
  openTab: (tab: QuoteTab) => void;
  closeTab: (id: string) => void;
  closeOthers: (id: string) => void;
  closeAll: () => void;
  /** Registra l'apertura di un preventivo nella lista dei recenti. */
  recordRecent: (id: string) => void;
}

const MAX_RECENT = 12;

export const useQuoteTabs = create<QuoteTabsState>()(
  persist(
    (set) => ({
      tabs: [],
      recent: [],
      openTab: (tab) =>
        set((s) => {
          const exists = s.tabs.some((t) => t.id === tab.id);
          const tabs = exists
            ? s.tabs.map((t) => (t.id === tab.id ? { ...t, code: tab.code, title: tab.title } : t))
            : [...s.tabs, tab];
          return { tabs };
        }),
      closeTab: (id) => set((s) => ({ tabs: s.tabs.filter((t) => t.id !== id) })),
      closeOthers: (id) => set((s) => ({ tabs: s.tabs.filter((t) => t.id === id) })),
      closeAll: () => set({ tabs: [] }),
      recordRecent: (id) =>
        set((s) => ({
          recent: [{ id, at: Date.now() }, ...s.recent.filter((r) => r.id !== id)].slice(0, MAX_RECENT),
        })),
    }),
    { name: "dieffe-quote-tabs", version: 1 }
  )
);
