"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
} from "@/lib/push-client";

/** Rileva se siamo in PWA installata (necessario per le push su iOS). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari legacy
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS si presenta come Mac con touch
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PushToggle() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isPushSupported()) {
        // Su iOS le push richiedono la PWA installata: distinguiamo il caso.
        if (active) {
          setSupported(false);
          setNeedsInstall(isIOS() && !isStandalone());
          setLoading(false);
        }
        return;
      }
      const state = await getPushState();
      if (!active) return;
      setEnabled(state.subscribed && state.permission === "granted");
      setDenied(state.permission === "denied");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function toggle() {
    setLoading(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success("Notifiche push disattivate");
      } else {
        const res = await subscribeToPush();
        if (res.ok) {
          setEnabled(true);
          toast.success("Notifiche push attivate 🔔");
        } else {
          if (res.reason.includes("negato")) setDenied(true);
          toast.error(res.reason);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  // Non supportato (es. iOS Safari non installato come app)
  if (!supported) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <BellOff className="h-[18px] w-[18px] text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Notifiche push</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {needsInstall
              ? "Aggiungi l'app alla schermata Home (Condividi → Aggiungi a Home) per ricevere le notifiche native."
              : "Non supportate su questo dispositivo o browser."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          enabled ? "bg-primary/10" : "bg-secondary"
        )}
      >
        <Bell
          className={cn(
            "h-[18px] w-[18px]",
            enabled ? "text-primary" : "text-foreground"
          )}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Notifiche push</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {denied
            ? "Bloccate dal browser. Abilitale dalle impostazioni del sito."
            : enabled
            ? "Attive su questo dispositivo."
            : "Ricevi le notifiche anche ad app chiusa."}
        </p>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={loading || denied}
        aria-pressed={enabled}
        aria-label="Attiva/disattiva notifiche push"
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
          enabled ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </span>
      </button>
    </div>
  );
}
