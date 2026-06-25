"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FileText,
  PenLine,
  Sparkles,
  BarChart3,
  ShieldCheck,
  MonitorSmartphone,
  CheckCircle2,
  Clock,
  ArrowRight,
  Download,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  cn,
} from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

const GITHUB_URL = "https://github.com/thomas-addamo/dieffe-preventivi";
const RELEASES_URL = `${GITHUB_URL}/releases/latest`;

/* ── Icone brand (inline) ────────────────────────────────────────────────── */
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

const Logo = ({ size = 36 }: { size?: number }) => (
  <span
    className="inline-flex items-center justify-center rounded-xl border bg-card shadow-2xs"
    style={{ width: size, height: size }}
  >
    <Image src="/icona_dieffe.svg" alt="Dieffe" width={size * 0.62} height={size * 0.62} priority />
  </span>
);

/* ── Dati realistici per l'anteprima dashboard (riproduce l'app 1:1) ─────── */
const PREVIEW_STATS = [
  { icon: FileText, label: "Preventivi totali", value: "128", color: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" },
  { icon: CheckCircle2, label: "Accettati questo mese", value: "14", color: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400" },
  { icon: Clock, label: "In attesa di firma", value: "7", color: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
];
const PREVIEW_ROWS = [
  { code: "2026-014", title: "Ristrutturazione appartamento", client: "Rossi Costruzioni", status: "sent", amount: 27499 },
  { code: "2026-013", title: "Cappotto termico condominio", client: "Bianchi S.r.l.", status: "accepted", amount: 41200 },
  { code: "2026-012", title: "Rifacimento bagno", client: "M. Verdi", status: "draft", amount: 6850 },
  { code: "2026-011", title: "Impianto elettrico villa", client: "Ferrari Immobili", status: "accepted", amount: 18300 },
];

const FEATURES = [
  { icon: FileText, color: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400", title: "Preventivi professionali", body: "Sezioni, voci, IVA, sconti e note. Esporta in PDF, Excel, CSV e JSON con un clic." },
  { icon: PenLine, color: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400", title: "Firma digitale", body: "Il cliente firma dal link condivisibile. IP e data registrati con consenso GDPR." },
  { icon: Sparkles, color: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", title: "AI integrata", body: "Descrizioni professionali e suggerimenti di prezzo generati dall'intelligenza artificiale." },
  { icon: BarChart3, color: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400", title: "SAL e avanzamento", body: "Traccia lo stato di ogni cantiere e le milestone di pagamento, sempre aggiornate." },
  { icon: ShieldCheck, color: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400", title: "3 livelli di accesso", body: "Admin, Editor e Viewer. Ogni membro del team vede solo quello che deve vedere." },
  { icon: MonitorSmartphone, color: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400", title: "Desktop + Browser", body: "App nativa per macOS e Windows, con aggiornamenti automatici. E sempre dal browser." },
];

const STEPS = [
  { n: "01", title: "Crea il preventivo", body: "Aggiungi sezioni e voci, lascia che l'AI scriva le descrizioni e calcoli i totali." },
  { n: "02", title: "Invia e fai firmare", body: "Condividi un link sicuro: il cliente visualizza e firma digitalmente dal browser." },
  { n: "03", title: "Traccia il lavoro", body: "Segui stato, SAL e pagamenti di ogni cantiere da un'unica dashboard." },
];

export function LandingClient() {
  const router = useRouter();

  // Electron: la landing non va mai mostrata → login.
  useEffect(() => {
    if (typeof window !== "undefined" && window.electron?.isElectron) {
      router.replace("/login");
    }
  }, [router]);

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
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAVBAR ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="text-[15px] font-semibold tracking-tight">Dieffe Preventivi</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
            <a href="#funzioni" className="transition-colors hover:text-foreground">Funzioni</a>
            <a href="#anteprima" className="transition-colors hover:text-foreground">Anteprima</a>
            <a href="#come-funziona" className="transition-colors hover:text-foreground">Come funziona</a>
            <a href="#download" className="transition-colors hover:text-foreground">Download</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <GitHubIcon className="h-4 w-4" /> GitHub
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/login">Accedi</a>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href="#download"><Download className="h-4 w-4" /> Scarica</a>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        <div aria-hidden className="lp-grid-bg pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-3xl px-6 pb-10 pt-20 text-center sm:pt-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Disponibile per macOS, Windows e browser
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            I preventivi della tua impresa,
            <span className="block bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              gestiti come si deve.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Crea preventivi edili professionali, falli firmare digitalmente e traccia ogni cantiere.
            Dal desktop o dal browser — con l&apos;AI che lavora al tuo fianco.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="#download"><Download className="h-4 w-4" /> Scarica l&apos;app</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/login">Accedi dal browser <ArrowRight className="h-4 w-4" /></a>
            </Button>
          </div>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
            Realizzato per Dieffe Ristrutturazioni Moncalieri
          </p>
        </div>

        {/* ── APP PREVIEW (riproduce fedelmente la dashboard) ─────────────── */}
        <div id="anteprima" className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="reveal-on-scroll overflow-hidden rounded-2xl border bg-card shadow-xl">
            {/* toolbar finestra */}
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-400/80" />
              <div className="mx-auto hidden items-center gap-2 rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground sm:flex">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                dieffe-preventivi.vercel.app/dashboard
              </div>
            </div>

            {/* corpo dashboard */}
            <div className="p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
                  <p className="text-xs text-muted-foreground">I tuoi preventivi più recenti</p>
                </div>
                <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs">
                  <span className="text-base leading-none">+</span> Nuovo preventivo
                </span>
              </div>

              {/* stat cards */}
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PREVIEW_STATS.map((s) => (
                  <div key={s.label} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                    <div className={cn("shrink-0 rounded-lg p-2", s.color)}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs leading-tight text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* tabella preventivi */}
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Codice</th>
                      <th className="px-4 py-2.5 font-medium">Preventivo</th>
                      <th className="hidden px-4 py-2.5 font-medium md:table-cell">Cliente</th>
                      <th className="px-4 py-2.5 font-medium">Stato</th>
                      <th className="px-4 py-2.5 text-right font-medium">Importo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {PREVIEW_ROWS.map((r) => (
                      <tr key={r.code} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{r.code}</td>
                        <td className="px-4 py-3 font-medium">{r.title}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{r.client}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", QUOTE_STATUS_COLORS[r.status])}>
                            {QUOTE_STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNZIONI ─────────────────────────────────────────────────────── */}
      <section id="funzioni" className="mx-auto max-w-6xl px-6 py-20">
        <div className="reveal-on-scroll mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-2 text-sm font-semibold text-primary">Funzioni</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Tutto quello che serve. Niente di superfluo.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pensato per le imprese edili, dalla prima voce alla firma del cliente.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="reveal-on-scroll group rounded-2xl border bg-card p-6 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              <div className={cn("mb-4 inline-flex rounded-xl p-2.5", f.color)}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 font-semibold tracking-tight">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COME FUNZIONA ────────────────────────────────────────────────── */}
      <section id="come-funziona" className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="reveal-on-scroll mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-2 text-sm font-semibold text-primary">Come funziona</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dal preventivo alla firma in 3 passi.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="reveal-on-scroll relative rounded-2xl border bg-card p-6 shadow-2xs"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <span className="text-sm font-mono font-semibold text-primary">{s.n}</span>
                <h3 className="mt-2 font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground/40 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOWNLOAD ─────────────────────────────────────────────────────── */}
      <section id="download" className="mx-auto max-w-5xl px-6 py-20">
        <div className="reveal-on-scroll mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-2 text-sm font-semibold text-primary">Download</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Scarica l&apos;app.</h2>
          <p className="mt-3 text-muted-foreground">Per macOS e Windows. Sempre aggiornata automaticamente.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { Icon: AppleIcon, title: "Dieffe per Mac", sub: "Intel & Apple Silicon", btn: "Scarica .dmg", req: "macOS 12+", iconCls: "h-9 w-9" },
            { Icon: WindowsIcon, title: "Dieffe per Windows", sub: "x64", btn: "Scarica .exe", req: "Windows 10+", iconCls: "h-8 w-8" },
          ].map((d) => (
            <div key={d.title} className="reveal-on-scroll flex flex-col items-center rounded-2xl border bg-card p-8 text-center shadow-2xs transition-shadow hover:shadow-md">
              <d.Icon className={cn("mb-4 text-foreground", d.iconCls)} />
              <h3 className="text-lg font-semibold tracking-tight">{d.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.sub}</p>
              <Button asChild className="mt-5">
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" /> {d.btn}
                </a>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">v{APP_VERSION} · Richiede {d.req}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" /> Aggiornamenti automatici</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" /> Funziona offline</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" /> Nessun abbonamento</span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <GitHubIcon className="h-4 w-4" /> Visualizza su GitHub
            </a>
          </Button>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <Logo size={34} />
            <div>
              <p className="text-sm font-semibold tracking-tight">Dieffe Preventivi</p>
              <p className="text-xs text-muted-foreground">Dieffe Ristrutturazioni Moncalieri · P.IVA 13460330015</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="https://impresadieffe.it" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">impresadieffe.it</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">GitHub</a>
            <a href="/login" className="transition-colors hover:text-foreground">Accedi</a>
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          © 2026 Dieffe Ristrutturazioni. Tutti i diritti riservati. · v{APP_VERSION}
        </div>
      </footer>
    </div>
  );
}
