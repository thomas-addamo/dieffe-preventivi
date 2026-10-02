"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Collega i menu nativi dell'app desktop (Vai, File, Dock…) al router della
 * web app: la navigazione avviene senza ricaricare la pagina. Sul web non fa
 * nulla. Il main process verifica `window.__dieffeNavigate` prima di usarla.
 */
export function DesktopBridge() {
  const router = useRouter();

  useEffect(() => {
    const electron = window.electron;
    if (!electron?.onNavigate) return;
    const off = electron.onNavigate((path) => {
      if (path.startsWith("/")) router.push(path);
    });
    window.__dieffeNavigate = () => {};
    return () => {
      off();
      delete window.__dieffeNavigate;
    };
  }, [router]);

  return null;
}
