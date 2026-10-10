"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isIOSApp, postToIOSApp } from "@/lib/ios-app";

/**
 * Collega i menu nativi dell'app desktop (Vai, File, Dock…) al router della
 * web app: la navigazione avviene senza ricaricare la pagina. Sul web non fa
 * nulla. Il main process verifica `window.__dieffeNavigate` prima di usarla.
 */
export function DesktopBridge() {
  const router = useRouter();
  const pathname = usePathname();

  // App iPhone: la tab bar nativa naviga con window.__dieffeIOSNavigate(path).
  useEffect(() => {
    if (!isIOSApp()) return;
    window.__dieffeIOSNavigate = (path) => {
      if (path.startsWith("/")) router.push(path);
    };
    return () => {
      delete window.__dieffeIOSNavigate;
    };
  }, [router]);

  // App iPhone: ogni cambio di pagina (anche senza ricaricare) arriva all'app.
  useEffect(() => {
    postToIOSApp({ action: "route", path: pathname });
  }, [pathname]);

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
