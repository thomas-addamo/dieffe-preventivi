import type { MetadataRoute } from "next";

// Web App Manifest — fa sì che, una volta aggiunta alla Home, l'app resti in
// modalità standalone (senza barra del browser) su TUTTE le pagine in-scope,
// non solo sulla dashboard. iOS apre in standalone solo ciò che è dentro `scope`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dieffe Preventivi",
    short_name: "Dieffe",
    description: "Gestione preventivi edili — Dieffe Ristrutturazioni",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8fa",
    theme_color: "#1e40af",
    icons: [
      {
        src: "/icona_dieffe.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
