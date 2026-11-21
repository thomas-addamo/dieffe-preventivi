"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { localFix, mapCaret, worthAi } from "@/lib/autocorrect-text";
import { useAutoCorrectDelay, useEditorPref, type EditorPref } from "@/lib/editor-prefs";

// ─────────────────────────────────────────────────────────────────────────────
// Correzione automatica (B2) di un campo di testo.
//  • parte solo dopo `delay` secondi senza modifiche (Impostazioni, predefinito 3);
//  • prima le correzioni sicure in locale, poi l'IA (/api/ai/proofread) solo
//    se il testo ha almeno tre parole e non è già stato controllato;
//  • se nel frattempo l'utente ha scritto ancora, la correzione si scarta;
//  • nei campi semplici il cursore resta al suo posto; negli editor ricchi
//    (descrizioni) si applica quando si esce dal campo;
//  • la notifica ha "Annulla", che ripristina il testo e non lo ricorregge.
// ─────────────────────────────────────────────────────────────────────────────

/** Testi già controllati dall'IA (in questa sessione): niente chiamate doppie. */
const checked = new Set<string>();
/** Testi che l'utente ha voluto tenere così ("Annulla"). */
const kept = new Set<string>();
let aiUnavailable = false;

async function aiProofread(text: string, signal: AbortSignal): Promise<string> {
  if (aiUnavailable || checked.has(text) || !worthAi(text)) return text;
  const res = await fetch("/api/ai/proofread", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  // IA spenta dall'admin o non configurata: per questa sessione solo locale.
  if (res.status === 403 || res.status === 503) aiUnavailable = true;
  if (!res.ok) return text;
  const data = (await res.json()) as { corrected?: string; changes?: unknown[] };
  const out = data.changes?.length && data.corrected ? data.corrected : text;
  checked.add(out);
  checked.add(text);
  return out;
}

export function useAutoCorrect(opts: {
  pref: EditorPref;
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Campo semplice (input/textarea): si corregge anche col cursore dentro. */
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  /** Editor ricco: selettore del suo contenitore; se il cursore è lì dentro si
   *  aspetta che il fuoco esca (riscrivere il contenuto sposterebbe il cursore). */
  richSelector?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [enabled] = useEditorPref(opts.pref);
  const [delay] = useAutoCorrectDelay();
  const value = opts.value ?? "";
  const latest = useRef(value);
  const onChangeRef = useRef(opts.onChange);
  const lastApplied = useRef<string | null>(null);
  // Solo ciò che l'utente scrive: i testi già salvati non si toccano all'apertura.
  const initial = useRef(value);
  const optsRef = useRef(opts);
  useEffect(() => {
    latest.current = value;
    onChangeRef.current = opts.onChange;
    optsRef.current = opts;
  });

  useEffect(() => {
    if (!enabled || opts.disabled || !value.trim() || value === initial.current || value === lastApplied.current || kept.has(value)) return;
    const original = value;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      let next = localFix(original);
      try {
        next = await aiProofread(next, ctrl.signal);
      } catch {
        /* rete o annullato: resta la correzione locale */
      }
      if (ctrl.signal.aborted || latest.current !== original || next === original) return;
      apply(original, next);
    }, delay * 1000);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };

    function apply(before: string, after: string) {
      const { inputRef, richSelector, label } = optsRef.current;
      const commit = () => {
        if (latest.current !== before) return; // l'utente ha ripreso a scrivere
        const el = inputRef?.current;
        const focused = !!el && document.activeElement === el;
        const caret = focused ? el.selectionStart ?? before.length : null;
        lastApplied.current = after;
        onChangeRef.current(after);
        if (focused && caret !== null) {
          requestAnimationFrame(() => {
            const pos = mapCaret(before, after, caret);
            try {
              el.setSelectionRange(pos, pos);
            } catch {
              /* campo non testuale */
            }
          });
        }
        toast(`${label ?? "Testo"} corretto`, {
          id: `autocorrect-${label}`,
          duration: 5000,
          action: {
            label: "Annulla",
            onClick: () => {
              kept.add(before);
              lastApplied.current = before;
              onChangeRef.current(before);
            },
          },
        });
      };
      const box = richSelector ? (document.activeElement?.closest(richSelector) as HTMLElement | null) : null;
      if (box) {
        // Editor ricco con il cursore dentro: si applica uscendo dal campo.
        const onOut = (e: FocusEvent) => {
          if (box.contains(e.relatedTarget as Node | null)) return;
          box.removeEventListener("focusout", onOut);
          commit();
        };
        box.addEventListener("focusout", onOut);
      } else commit();
    }
  }, [value, enabled, delay, opts.disabled]);
}
