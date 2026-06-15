"use client";

import { useEffect } from "react";
import { registerServiceWorker, isPushSupported } from "@/lib/push-client";

/**
 * Registra il service worker all'avvio dell'app (idempotente).
 * NON chiede permessi qui: il permesso si richiede da un gesto utente
 * (toggle in Profilo). Serve però avere il SW attivo per ricevere i
 * messaggi realtime e le push quando il permesso è già concesso.
 */
export function PushRegistrar() {
  useEffect(() => {
    if (!isPushSupported()) return;
    registerServiceWorker();
  }, []);

  return null;
}
