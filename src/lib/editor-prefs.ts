"use client";

import { useCallback, useSyncExternalStore } from "react";

// Preferenze personali dell'editor voci, salvate su questo dispositivo.
// Un cambio da Impostazioni (o dal pulsante "Disattiva" nell'editor) si
// riflette subito su tutte le voci aperte, anche in altre schede.

export const EDITOR_PREFS = {
  /** Tendina "Dal listino" con voci simili mentre si scrive la descrizione. */
  listinoAutocomplete: "listino_autocomplete_enabled",
  /** Suggerimento AI automatico di U.M./prezzo mentre si scrive. */
  aiPriceSuggestions: "ai_suggestions_enabled",
  /** Correzione automatica (B2) del titolo del preventivo. */
  autoCorrectTitle: "autocorrect_title_enabled",
  /** Correzione automatica delle descrizioni delle voci. */
  autoCorrectDescriptions: "autocorrect_descriptions_enabled",
  /** Correzione automatica delle note (generali e delle voci). */
  autoCorrectNotes: "autocorrect_notes_enabled",
} as const;

/** Secondi di inattività prima della correzione automatica (B2). */
export const AUTOCORRECT_DELAY_KEY = "autocorrect_delay_s";
export const AUTOCORRECT_DELAY_DEFAULT = 3;
export const AUTOCORRECT_DELAYS = [1, 2, 3, 5, 10] as const;

export function readAutoCorrectDelay(): number {
  try {
    const v = Number(localStorage.getItem(AUTOCORRECT_DELAY_KEY));
    return v >= 1 && v <= 30 ? v : AUTOCORRECT_DELAY_DEFAULT;
  } catch {
    return AUTOCORRECT_DELAY_DEFAULT;
  }
}

export function writeAutoCorrectDelay(seconds: number) {
  try {
    localStorage.setItem(AUTOCORRECT_DELAY_KEY, String(seconds));
  } catch {
    // storage non disponibile: ignora
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAutoCorrectDelay(): [number, (s: number) => void] {
  const value = useSyncExternalStore(subscribe, readAutoCorrectDelay, () => AUTOCORRECT_DELAY_DEFAULT);
  return [value, writeAutoCorrectDelay];
}

export type EditorPref = keyof typeof EDITOR_PREFS;

const CHANGE_EVENT = "dieffe:editor-prefs";

export function readEditorPref(pref: EditorPref): boolean {
  try {
    return localStorage.getItem(EDITOR_PREFS[pref]) !== "false";
  } catch {
    return true;
  }
}

export function writeEditorPref(pref: EditorPref, enabled: boolean) {
  try {
    localStorage.setItem(EDITOR_PREFS[pref], String(enabled));
  } catch {
    // storage non disponibile (es. navigazione privata): ignora
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useEditorPref(pref: EditorPref): [boolean, (enabled: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readEditorPref(pref),
    () => true
  );
  const set = useCallback((enabled: boolean) => writeEditorPref(pref, enabled), [pref]);
  return [value, set];
}
