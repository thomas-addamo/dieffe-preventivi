import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import { LandingClient } from "./LandingClient";
import "./landing.css";

// Font caricati qui (server component): next/font/google non è usabile in un
// client component. Restano scoped alla landing tramite le CSS variables.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dieffe Preventivi — Il gestionale per preventivi edili",
  description:
    "Crea, invia, fai firmare e traccia i preventivi della tua impresa edile. App nativa per macOS e Windows, sempre disponibile anche dal browser.",
};

export default function Home() {
  return <LandingClient fontClass={`${spaceGrotesk.variable} ${plusJakarta.variable}`} />;
}
