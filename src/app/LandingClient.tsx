"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { APP_VERSION } from "@/lib/version";

const GITHUB_URL = "https://github.com/thomas-addamo/dieffe-preventivi";
const RELEASES_URL = `${GITHUB_URL}/releases/latest`;

/* ── Icone brand (inline, niente dipendenze) ─────────────────────────────── */
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" className={className} fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 448 512" className={className} fill="currentColor" aria-hidden>
      <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z" />
    </svg>
  );
}
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.2 11.19.6.11.82-.25.82-.56v-2c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.71.08-.71 1.2.08 1.84 1.21 1.84 1.21 1.07 1.79 2.81 1.27 3.49.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.31-5.47-5.84 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.21.96-.26 1.98-.39 3-.4 1.02.01 2.04.14 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.66 1.65.24 2.87.12 3.17.77.83 1.24 1.88 1.24 3.17 0 4.54-2.81 5.53-5.49 5.83.43.36.81 1.08.81 2.18v3.23c0 .31.22.68.83.56C20.56 21.91 24 17.5 24 12.29 24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

/* ── Feature cards ───────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: "⚡",
    title: "Preventivi professionali",
    body: "Sezioni, voci, IVA, sconti e note. Esporta in PDF, Excel, CSV e JSON.",
  },
  {
    icon: "✍️",
    title: "Firma digitale",
    body: "Il cliente firma dal link condivisibile. IP registrato con consenso GDPR.",
  },
  {
    icon: "🤖",
    title: "AI integrata",
    body: "Descrizioni professionali e suggerimenti di prezzo generati dall'intelligenza artificiale.",
  },
  {
    icon: "📊",
    title: "SAL e avanzamento",
    body: "Traccia lo stato di ogni cantiere e le milestone di pagamento.",
  },
  {
    icon: "🔒",
    title: "3 livelli di accesso",
    body: "Admin, Editor, Viewer. Ogni utente vede solo quello che deve.",
  },
  {
    icon: "💻",
    title: "Desktop + Browser",
    body: "App nativa per macOS e Windows. Sempre disponibile anche dal browser.",
  },
];

/* ── Mock dell'editor mostrato nella hero ────────────────────────────────── */
const MOCK_ROWS = [
  { code: "01", label: "Allestimento Cantiere", value: "2.450,00" },
  { code: "02", label: "Demolizioni e rimozioni", value: "5.180,00" },
  { code: "03", label: "Cappotto Termico", value: "14.920,00" },
];

export function LandingClient({ fontClass }: { fontClass: string }) {
  const router = useRouter();
  const blob1 = useRef<HTMLDivElement>(null);
  const blob2 = useRef<HTMLDivElement>(null);
  const blob3 = useRef<HTMLDivElement>(null);

  // Electron: la landing non va mai mostrata → login.
  useEffect(() => {
    if (typeof window !== "undefined" && window.electron?.isElectron) {
      router.replace("/login");
    }
  }, [router]);

  // Parallax dei blob al movimento del puntatore.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      blob1.current?.style.setProperty("margin-left", `${dx * 40}px`);
      blob1.current?.style.setProperty("margin-top", `${dy * 40}px`);
      blob2.current?.style.setProperty("margin-left", `${dx * -55}px`);
      blob2.current?.style.setProperty("margin-top", `${dy * -35}px`);
      blob3.current?.style.setProperty("margin-left", `${dx * 30}px`);
      blob3.current?.style.setProperty("margin-top", `${dy * -45}px`);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Reveal on scroll.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function handleTilt(e: React.PointerEvent<HTMLDivElement>) {
    const card = e.currentTarget;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateY(-4px)`;
  }
  function handleTiltLeave(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.style.transform = "";
  }

  const logo = (
    <span className="lp-logo-chip inline-flex items-center justify-center rounded-xl p-1.5">
      <Image src="/icona_dieffe.svg" alt="Dieffe" width={26} height={26} priority className="h-[26px] w-[26px]" />
    </span>
  );

  return (
    <div className={`lp-root min-h-screen overflow-x-hidden ${fontClass}`}>
      {/* ── SVG FILTERS (solo definizioni) ─────────────────────────────────── */}
      <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="glassRefract" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0010 0.0014" numOctaves={2} seed={42} result="noise" />
            <feGaussianBlur in="noise" stdDeviation="1.2" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale={38} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="glassRefractSoft" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0018 0.0022" numOctaves={2} seed={11} result="noise" />
            <feGaussianBlur in="noise" stdDeviation="0.9" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale={20} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* ── BACKGROUND AMBIENT ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          background: "radial-gradient(120% 90% at 50% -10%, #0a1840 0%, #050b22 55%, #03060f 100%)",
        }}
      >
        <div
          ref={blob1}
          className="lp-blob"
          style={{
            position: "absolute", top: "-12%", left: "-8%", width: "48vw", height: "48vw", borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, oklch(0.7 0.17 248), transparent 68%)",
            filter: "blur(40px)", opacity: 0.85, animation: "blobA 26s ease-in-out infinite",
          }}
        />
        <div
          ref={blob2}
          className="lp-blob"
          style={{
            position: "absolute", top: "18%", right: "-12%", width: "42vw", height: "42vw", borderRadius: "50%",
            background: "radial-gradient(circle at 50% 50%, oklch(0.66 0.18 268), transparent 66%)",
            filter: "blur(46px)", opacity: 0.75, animation: "blobB 32s ease-in-out infinite",
          }}
        />
        <div
          ref={blob3}
          className="lp-blob"
          style={{
            position: "absolute", bottom: "-18%", left: "28%", width: "50vw", height: "50vw", borderRadius: "50%",
            background: "radial-gradient(circle at 50% 50%, oklch(0.62 0.15 224), transparent 64%)",
            filter: "blur(52px)", opacity: 0.7, animation: "blobC 38s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(2,5,15,.7) 100%)",
          }}
        />
      </div>

      {/* ════════════════ DESKTOP / TABLET ════════════════ */}
      <div className="relative z-10 hidden md:block">
        {/* NAVBAR */}
        <nav className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
          <div className="glass-nav mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5">
            <a href="#top" className="flex items-center gap-2.5">
              {logo}
              <span className="lp-display text-[15px] font-semibold text-white">Dieffe Preventivi</span>
            </a>
            <div className="hidden items-center gap-7 text-sm font-medium text-white/70 lg:flex">
              <a href="#funzioni" className="transition-colors hover:text-white">Funzioni</a>
              <a href="#anteprima" className="transition-colors hover:text-white">Anteprima</a>
              <a href="#download" className="transition-colors hover:text-white">Download</a>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-btn-secondary hidden items-center gap-2 rounded-xl px-3.5 py-2 text-sm sm:inline-flex"
              >
                <GitHubIcon className="h-4 w-4" /> GitHub
              </a>
              <a href="/login" className="glass-btn-secondary rounded-xl px-3.5 py-2 text-sm">Accedi</a>
              <a href="#download" className="glass-btn-primary rounded-xl px-4 py-2 text-sm">Scarica</a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <header id="top" className="mx-auto max-w-6xl px-6 pb-10 pt-36">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span className="glass-nav mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-white/85">
                <span className="lp-pulse-dot inline-block h-2 w-2 rounded-full bg-sky-400" />
                Disponibile per macOS &amp; Windows
              </span>
              <h1 className="lp-display text-5xl font-bold leading-[1.05] text-white sm:text-6xl">
                Gestisci i preventivi
                <br />
                della tua impresa.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
                Dieffe Preventivi è il gestionale professionale per preventivi edili. Crea, invia,
                fai firmare e traccia ogni lavoro — da desktop o dal browser.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="glass-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px]">
                  <AppleIcon className="h-5 w-5" /> Scarica per Mac
                </a>
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="glass-btn-secondary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px]">
                  <WindowsIcon className="h-[18px] w-[18px]" /> Scarica per Windows
                </a>
                <a href="/login" className="inline-flex items-center gap-1.5 px-2 py-3 text-[15px] font-medium text-white/75 transition-colors hover:text-white">
                  Accedi al sito →
                </a>
              </div>
              <p className="mt-6 text-xs font-medium uppercase tracking-wider text-white/40">
                Usato da Dieffe Ristrutturazioni Moncalieri
              </p>
            </div>

            {/* HERO MOCKUP */}
            <div id="anteprima" className="lp-float">
              <div className="glass-surface rounded-3xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="lp-display text-sm font-semibold text-white">Preventivo #2026-014</div>
                    <div className="text-xs text-white/55">Cliente · Rossi Costruzioni S.r.l.</div>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                    In attesa di firma
                  </span>
                </div>
                <div className="space-y-2">
                  {MOCK_ROWS.map((r) => (
                    <div
                      key={r.code}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-[11px] font-semibold text-white/70">
                          {r.code}
                        </span>
                        <span className="text-sm text-white/85">{r.label}</span>
                      </div>
                      <span className="font-mono text-sm text-white/90">€ {r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-sky-400/20 bg-sky-400/10 px-3.5 py-3.5">
                  <span className="text-sm font-semibold text-white">Totale (IVA 22% incl.)</span>
                  <span className="lp-display font-mono text-lg font-bold text-white">€ 27.499,00</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* FEATURES */}
        <section id="funzioni" className="mx-auto max-w-6xl px-6 py-20">
          <div className="reveal-on-scroll mx-auto mb-14 max-w-2xl text-center">
            <h2 className="lp-display text-3xl font-bold text-white sm:text-4xl">
              Tutto quello che serve. Niente di superfluo.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                onPointerMove={handleTilt}
                onPointerLeave={handleTiltLeave}
                className="glass-card reveal-on-scroll rounded-2xl p-6"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">
                  {f.icon}
                </div>
                <h3 className="lp-display mb-1.5 text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DOWNLOAD */}
        <section id="download" className="mx-auto max-w-5xl px-6 py-20">
          <div className="reveal-on-scroll mx-auto mb-12 max-w-2xl text-center">
            <h2 className="lp-display text-3xl font-bold text-white sm:text-4xl">Scarica l&apos;app.</h2>
            <p className="mt-3 text-white/60">
              Disponibile per macOS e Windows. Sempre aggiornata automaticamente.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card reveal-on-scroll flex flex-col items-center rounded-2xl p-8 text-center"
            >
              <AppleIcon className="mb-4 h-12 w-12 text-white" />
              <h3 className="lp-display text-xl font-semibold text-white">Dieffe Preventivi per Mac</h3>
              <p className="mt-1 text-sm text-white/55">Intel &amp; Apple Silicon</p>
              <span className="glass-btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
                Scarica .dmg
              </span>
              <p className="mt-3 text-xs text-white/45">v{APP_VERSION} · Richiede macOS 12+</p>
            </a>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card reveal-on-scroll flex flex-col items-center rounded-2xl p-8 text-center"
            >
              <WindowsIcon className="mb-4 h-11 w-11 text-white" />
              <h3 className="lp-display text-xl font-semibold text-white">Dieffe Preventivi per Windows</h3>
              <p className="mt-1 text-sm text-white/55">x64</p>
              <span className="glass-btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
                Scarica .exe
              </span>
              <p className="mt-3 text-xs text-white/45">v{APP_VERSION} · Richiede Windows 10+</p>
            </a>
          </div>
          <div className="mt-8 flex flex-col items-center gap-3 text-sm">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-white/70 transition-colors hover:text-white"
            >
              <GitHubIcon className="h-4 w-4" /> Visualizza su GitHub →
            </a>
            <a href="/login" className="font-medium text-white/55 transition-colors hover:text-white">
              Preferisci il browser? Accedi dal sito →
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mx-auto max-w-6xl px-6 py-12">
          <div className="glass-nav flex flex-col items-center gap-5 rounded-2xl px-6 py-8 text-center">
            <div className="flex items-center gap-2.5">
              {logo}
              <span className="lp-display text-sm font-semibold text-white">Dieffe Preventivi</span>
            </div>
            <div className="text-sm text-white/55">
              Dieffe Ristrutturazioni Moncalieri
              <br />
              P.IVA 10908150013 ·{" "}
              <a href="https://impresadieffe.it" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                impresadieffe.it
              </a>
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-white/70">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">GitHub</a>
              <a href="/login" className="hover:text-white">Accedi</a>
            </div>
            <div className="text-xs text-white/40">
              © 2026 Dieffe Ristrutturazioni. Tutti i diritti riservati.
            </div>
          </div>
        </footer>
      </div>

      {/* ════════════════ MOBILE ════════════════ */}
      <div className="relative z-10 flex min-h-screen flex-col px-6 pb-12 pt-14 md:hidden">
        <div className="flex items-center gap-2.5">
          {logo}
          <span className="lp-display text-base font-semibold text-white">Dieffe Preventivi</span>
        </div>

        <div className="mt-14">
          <h1 className="lp-display text-4xl font-bold leading-[1.08] text-white">
            Gestisci i preventivi
            <br />
            della tua impresa.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/65">
            L&apos;app professionale per preventivi edili.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <AppleIcon className="h-6 w-6 shrink-0 text-white" />
              <div>
                <div className="text-sm font-semibold text-white">Scarica per iPhone / iPad</div>
                <div className="text-xs text-white/55">PWA — Safari → Condividi → Aggiungi a Home</div>
              </div>
            </div>
          </div>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="glass-card flex items-center gap-3 rounded-2xl p-4">
            <AppleIcon className="h-6 w-6 shrink-0 text-white" />
            <div className="text-sm font-semibold text-white">Scarica per Mac (.dmg)</div>
          </a>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="glass-card flex items-center gap-3 rounded-2xl p-4">
            <WindowsIcon className="h-5 w-5 shrink-0 text-white" />
            <div className="text-sm font-semibold text-white">Scarica per Windows (.exe)</div>
          </a>
        </div>

        <a href="/login" className="glass-btn-primary mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px]">
          Accedi dal browser →
        </a>

        <div className="mt-auto pt-12 text-center text-xs text-white/40">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-white/60 hover:text-white">
            Visualizza su GitHub →
          </a>
          <div className="mt-3">
            Dieffe Ristrutturazioni Moncalieri · P.IVA 10908150013
            <br />
            © 2026 — v{APP_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
}
