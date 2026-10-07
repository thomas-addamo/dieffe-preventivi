"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Comandi dalla barra dei menu dell'app desktop (electron/menu.ts): il menu
 * apre la pagina con un parametro (es. /clienti?nuovo=1), la pagina esegue
 * l'azione e toglie il parametro dall'indirizzo. Funziona anche sul web.
 */
export function useMenuParam(name: string, handler: (value: string) => void) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(name);
  const ref = useRef(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (value === null) return;
    ref.current(value);
    const next = new URLSearchParams(params.toString());
    next.delete(name);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo al nuovo comando
  }, [value]);
}

/** Eventi globali dei comandi di menu (ascoltati da barra laterale, Aiuto…). */
export const MENU_EVENTS = {
  help: "dieffe:menu-help",
  toggleSidebar: "dieffe:menu-toggle-sidebar",
} as const;
