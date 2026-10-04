import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { SplashScreen } from "@/components/shared/SplashScreen";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dieffe Preventivi",
  description: "Gestione preventivi edili — Dieffe Ristrutturazioni",
  // Abilita l'installazione "Aggiungi a Home" come app standalone su iOS
  appleWebApp: {
    capable: true,
    title: "Dieffe",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Estende il layout sotto notch e home-indicator: abilita env(safe-area-inset-*)
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* App desktop (Electron): lo User-Agent contiene "DieffeDesktop/x.y.z (mac|win)".
            Marca <html> prima del primo paint: il design desktop è solo CSS
            (varianti desktop:/mac: in globals.css), quindi nessun mismatch SSR. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var m=navigator.userAgent.match(/DieffeDesktop\\/([\\d.]+) \\((\\w+)(?:; (\\d+))?\\)/);if(m){var d=document.documentElement;d.setAttribute('data-shell','desktop');d.setAttribute('data-platform',m[2]);if(m[2]==='mac'&&m[3]&&+m[3]<26)d.setAttribute('data-os-legacy','');}})()` }} />
        {/* Inline script: applica il tema PRIMA del render per evitare il flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})()` }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <ThemeProvider>
          <SplashScreen />
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
