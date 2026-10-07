"use client";

import { Suspense } from "react";
import { useTheme } from "@/components/shared/ThemeProvider";
import { MENU_EVENTS, useMenuParam } from "@/hooks/use-menu-param";

// Comandi globali dei menu nativi (valgono su qualsiasi pagina):
//   ?aiuto=assistente|admin   apre la finestra Aiuto
//   ?barra=1                  mostra/nasconde la barra laterale
//   ?tema=chiaro|scuro|sistema
//   ?novita=1                 rimostra il riquadro "Novità" della versione

function Handlers() {
  const { setTheme } = useTheme();
  useMenuParam("aiuto", (v) =>
    window.dispatchEvent(new CustomEvent(MENU_EVENTS.help, { detail: v === "admin" ? "admin" : "ai" }))
  );
  useMenuParam("barra", () => window.dispatchEvent(new Event(MENU_EVENTS.toggleSidebar)));
  useMenuParam("tema", (v) => setTheme(v === "scuro" ? "dark" : v === "chiaro" ? "light" : "system"));
  useMenuParam("novita", () => {
    try {
      localStorage.removeItem("whats_new_dismissed");
    } catch {
      /* niente storage: il riquadro resta com'è */
    }
    window.dispatchEvent(new Event("dieffe:whats-new"));
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  });
  return null;
}

export function MenuActions() {
  return (
    <Suspense fallback={null}>
      <Handlers />
    </Suspense>
  );
}
