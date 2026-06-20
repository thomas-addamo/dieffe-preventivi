"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

/**
 * Splash di avvio app — mostrato all'apertura (cold load / refresh / lancio PWA),
 * mentre React si idrata e l'app "si connette". È renderizzato anche in SSR, quindi
 * copre lo schermo già al primo paint, poi sfuma via dopo l'idratazione.
 *
 * - Logo brand + spinner.
 * - Versione app in basso SOLO su mobile (< lg), come richiesto.
 * - NON ricompare nelle navigazioni client (il root layout non si rimonta): per quelle
 *   c'è il loader di pagina (app/(app)/loading.tsx).
 */
export function SplashScreen() {
  const [hiding, setHiding] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Tempo minimo di visibilità per un'uscita morbida, poi fade-out e unmount.
    const t1 = setTimeout(() => setHiding(true), 900);
    const t2 = setTimeout(() => setRemoved(true), 900 + 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-[400ms] ease-out ${
        hiding ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        <Image
          src="/icona_dieffe.svg"
          alt="Dieffe"
          width={96}
          height={96}
          priority
          className="h-24 w-24 animate-[splash-pop_0.5s_cubic-bezier(0.32,0.72,0,1)] drop-shadow-sm"
        />
        <Loader2 className="h-7 w-7 animate-spin text-primary" strokeWidth={2.5} />
      </div>

      {/* Versione — solo mobile, ancorata in basso con safe-area */}
      <span className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] text-xs font-medium tracking-wide text-muted-foreground lg:hidden">
        v{APP_VERSION}
      </span>
    </div>
  );
}
