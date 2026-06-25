import type { Metadata } from "next";
import { LandingClient } from "./LandingClient";
import "./landing.css";

export const metadata: Metadata = {
  title: "Dieffe Preventivi — Il gestionale per preventivi edili",
  description:
    "Crea, invia, fai firmare e traccia i preventivi della tua impresa edile. App nativa per macOS e Windows, sempre disponibile anche dal browser.",
};

export default function Home() {
  return <LandingClient />;
}
