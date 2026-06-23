"use client";

import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Save,
  Upload,
  X,
  AlertTriangle,
  Sparkles,
  BellRing,
  FileText,
  ShieldCheck,
  User,
  Bell,
  Palette,
  Building2,
  Hash,
  Mail,
  KeyRound,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CompanySettings } from "@/lib/db/schema";
import { APP_VERSION } from "@/lib/version";
import { useTheme } from "@/components/shared/ThemeProvider";
import { ChangePasswordDialog } from "@/components/shared/ChangePasswordDialog";
import { PushToggle } from "@/components/shared/PushToggle";

/** Toggle iOS-style riutilizzabile per le impostazioni booleane. */
function SettingToggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

/** Contenitore di una sezione con ancora per la nav laterale. */
function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 bg-card border rounded-xl p-5 space-y-4">
      <h2 className="font-medium text-sm flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

const schema = z.object({
  companyName: z.string().min(1, "Nome azienda obbligatorio"),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  defaultVatRate: z.number().min(0).max(100),
  defaultExportPath: z.string().optional(),
  pdfTemplate: z.enum(["classic", "modern", "minimal"]),
  primaryColor: z.string(),
  accentColor: z.string(),
  emailFromAddress: z.string().email("Email non valida").optional().or(z.literal("")),
  quotePrefix: z.string().max(6).regex(/^[A-Z0-9]*$/, "Solo lettere maiuscole e numeri").optional(),
  notifyTeamOnAccept: z.boolean(),
  notifyTeamOnReject: z.boolean(),
  defaultPaymentTerms: z.string().optional(),
  defaultQuoteNotes: z.string().optional(),
  aiEnabled: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface NavItem {
  id: string;
  label: string;
  icon: typeof User;
}

export function ImpostazioniClient({
  initialSettings,
  isAdmin,
  userName,
  userEmail,
}: {
  initialSettings: CompanySettings | null;
  isAdmin: boolean;
  userName: string;
  userEmail: string;
}) {
  const { theme, setTheme } = useTheme();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(
    initialSettings?.logoPath ?? null
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [aiSuggestEnabled, setAiSuggestEnabled] = useState(true);
  const [aiAutoImprove, setAiAutoImprove] = useState(false);

  useEffect(() => {
    setAiSuggestEnabled(localStorage.getItem("ai_suggestions_enabled") !== "false");
    setAiAutoImprove(localStorage.getItem("ai_auto_improve") === "true");
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: initialSettings?.companyName ?? "",
      address: initialSettings?.address ?? "",
      vatNumber: initialSettings?.vatNumber ?? "",
      email: initialSettings?.email ?? "",
      phone: initialSettings?.phone ?? "",
      website: initialSettings?.website ?? "",
      defaultVatRate: initialSettings?.defaultVatRate ?? 22,
      defaultExportPath: initialSettings?.defaultExportPath ?? "",
      pdfTemplate: initialSettings?.pdfTemplate ?? "classic",
      primaryColor: initialSettings?.primaryColor ?? "#1e40af",
      accentColor: initialSettings?.accentColor ?? "#059669",
      emailFromAddress: initialSettings?.emailFromAddress ?? "",
      quotePrefix: initialSettings?.quotePrefix ?? "PREV",
      notifyTeamOnAccept: initialSettings?.notifyTeamOnAccept ?? true,
      notifyTeamOnReject: initialSettings?.notifyTeamOnReject ?? false,
      defaultPaymentTerms: initialSettings?.defaultPaymentTerms ?? "",
      defaultQuoteNotes: initialSettings?.defaultQuoteNotes ?? "",
      aiEnabled: initialSettings?.aiEnabled ?? true,
    },
  });

  const watchedPrefix = watch("quotePrefix") ?? "PREV";
  const notifyAccept = watch("notifyTeamOnAccept");
  const notifyReject = watch("notifyTeamOnReject");
  const aiEnabled = watch("aiEnabled");

  async function resetCounter() {
    if (resetConfirmText !== "RESET") return;
    setResetting(true);
    const res = await fetch("/api/settings/reset-counter", { method: "POST" });
    setResetting(false);
    if (res.ok) {
      toast.success("Contatore resettato.");
      setShowResetConfirm(false);
      setResetConfirmText("");
    } else {
      toast.error("Errore durante il reset.");
    }
  }

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Impostazioni salvate");
    } else {
      toast.error("Errore durante il salvataggio");
    }
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
    setLogoUploading(false);
    if (res.ok) {
      const { logoPath: p } = await res.json();
      setLogoPath(p + "?t=" + Date.now());
      toast.success("Logo caricato");
    } else {
      const j = await res.json();
      toast.error(j.error ?? "Errore upload logo");
    }
  }

  async function removeLogo() {
    const res = await fetch("/api/settings/logo", { method: "DELETE" });
    if (res.ok) {
      setLogoPath(null);
      toast.success("Logo rimosso");
    }
  }

  const themeOptions = [
    { value: "light", label: "Chiaro", icon: Sun },
    { value: "dark", label: "Scuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const;

  const navItems: NavItem[] = [
    { id: "account", label: "Account", icon: User },
    { id: "notifiche", label: "Notifiche", icon: Bell },
    { id: "aspetto", label: "Aspetto", icon: Palette },
    { id: "ai-personale", label: "Assistente AI", icon: Sparkles },
    ...(isAdmin
      ? [
          { id: "azienda", label: "Dati azienda", icon: Building2 },
          { id: "preventivi", label: "Preventivi", icon: FileText },
          { id: "email", label: "Email", icon: Mail },
          { id: "numerazione", label: "Numerazione", icon: Hash },
          { id: "team", label: "Notifiche team", icon: BellRing },
        ]
      : []),
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold lg:text-xl lg:font-semibold">Impostazioni</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin
            ? "Gestisci le tue preferenze personali e le impostazioni dell'azienda"
            : "Gestisci le tue preferenze personali"}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* Nav laterale (desktop) */}
        <nav className="hidden lg:flex flex-col gap-0.5 sticky top-6">
          {navItems.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </a>
          ))}
          <div className="mt-4 px-3 text-[11px] text-muted-foreground/60">
            Dieffe Preventivi · v{APP_VERSION}
          </div>
        </nav>

        {/* Contenuto */}
        <div className="space-y-6 min-w-0 max-w-3xl">
          {/* ───────── PERSONALI (tutti gli utenti) ───────── */}
          <Section id="account" title="Account" icon={User}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowChangePassword(true)}
              >
                <KeyRound className="h-4 w-4" /> Cambia password
              </Button>
            </div>
          </Section>

          <Section id="notifiche" title="Notifiche" icon={Bell}>
            <p className="text-xs text-muted-foreground -mt-2">
              Ricevi un avviso quando arrivano nuove notifiche (firma cliente,
              assegnazioni, comunicazioni).
            </p>
            <div className="-mx-5 -mb-1 border-t">
              <PushToggle />
            </div>
          </Section>

          <Section id="aspetto" title="Aspetto" icon={Palette}>
            <p className="text-xs text-muted-foreground -mt-2">Tema dell&apos;applicazione.</p>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors",
                    theme === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-accent text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section id="ai-personale" title="Assistente AI" icon={Sparkles}>
            <div className="flex items-center gap-2 -mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Preferenze salvate su questo dispositivo.
              </p>
            </div>
            <div className="space-y-3">
              <SettingToggle
                checked={aiSuggestEnabled}
                onChange={(next) => {
                  setAiSuggestEnabled(next);
                  localStorage.setItem("ai_suggestions_enabled", String(next));
                  toast.success(next ? "Suggerimenti AI attivati" : "Suggerimenti AI disattivati");
                }}
                title="Suggerimenti AI automatici"
                description="Suggerisce U.M. e prezzo mentre scrivi la descrizione"
              />
              <div className="border-t" />
              <SettingToggle
                checked={aiAutoImprove}
                onChange={(next) => {
                  setAiAutoImprove(next);
                  localStorage.setItem("ai_auto_improve", String(next));
                  toast.success(next ? "Auto-miglioramento attivato" : "Auto-miglioramento disattivato");
                }}
                title="Miglioramento automatico descrizione"
                description="Migliora automaticamente dopo 3s di inattività"
              />
            </div>
          </Section>

          {/* ───────── AZIENDALI (solo admin) ───────── */}
          {isAdmin && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Section id="azienda" title="Dati azienda" icon={Building2}>
                <p className="text-xs text-muted-foreground -mt-2">
                  Questi dati appaiono nell&apos;intestazione di tutti i preventivi.
                </p>
                {/* Logo */}
                <div className="flex items-center gap-4">
                  {logoPath ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoPath}
                        alt="Logo aziendale"
                        className="h-16 max-w-48 object-contain border rounded-lg bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-40 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground/50">
                      <span className="text-xs">Nessun logo</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {logoPath ? "Cambia logo" : "Carica logo"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground max-w-40">
                      PNG, JPG, WEBP, SVG — max 2MB
                    </p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Ragione sociale *</Label>
                    <Input {...register("companyName")} placeholder="Dieffe Ristrutturazioni" />
                    {errors.companyName && (
                      <p className="text-xs text-destructive">{errors.companyName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>P.IVA</Label>
                    <Input {...register("vatNumber")} placeholder="IT13460330015" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefono</Label>
                    <Input {...register("phone")} placeholder="+39 011 ..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input {...register("email")} type="email" placeholder="impresa.dieffe@gmail.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sito web</Label>
                    <Input {...register("website")} placeholder="diefferistrutturazioni.it" />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Indirizzo</Label>
                    <Input {...register("address")} placeholder="Via Roma 1, 10024 Moncalieri (TO)" />
                  </div>
                </div>
              </Section>

              <Section id="preventivi" title="Preventivi" icon={FileText}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>IVA predefinita %</Label>
                    <Input
                      {...register("defaultVatRate", { valueAsNumber: true })}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Template PDF</Label>
                    <Select
                      defaultValue={initialSettings?.pdfTemplate ?? "classic"}
                      onValueChange={(v) =>
                        setValue("pdfTemplate", v as "classic" | "modern" | "minimal")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic">Classico</SelectItem>
                        <SelectItem value="modern">Moderno</SelectItem>
                        <SelectItem value="minimal">Minimale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Colore primario</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" {...register("primaryColor")} className="h-9 w-14 rounded-md border cursor-pointer" />
                      <Input {...register("primaryColor")} className="font-mono text-sm" placeholder="#1e40af" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Colore accento</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" {...register("accentColor")} className="h-9 w-14 rounded-md border cursor-pointer" />
                      <Input {...register("accentColor")} className="font-mono text-sm" placeholder="#059669" />
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Condizioni di pagamento predefinite</Label>
                    <Textarea
                      {...register("defaultPaymentTerms")}
                      rows={2}
                      placeholder="Es: 30% all'accettazione, 40% a metà lavori, saldo a fine lavori."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note predefinite</Label>
                    <Textarea
                      {...register("defaultQuoteNotes")}
                      rows={2}
                      placeholder="Es: Prezzi IVA esclusa. Preventivo valido 30 giorni."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cartella di salvataggio export</Label>
                    <Input
                      {...register("defaultExportPath")}
                      placeholder="/Users/nome/Documenti/Preventivi"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </Section>

              <Section id="email" title="Configurazione Email" icon={Mail}>
                <div className="space-y-1.5">
                  <Label>Indirizzo email mittente</Label>
                  <Input {...register("emailFromAddress")} type="email" placeholder="preventivi@tuaazienda.it" />
                  {errors.emailFromAddress && (
                    <p className="text-xs text-destructive">{errors.emailFromAddress.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Mittente delle email di conferma firma inviate ai clienti. Deve essere un dominio verificato su Resend.
                  </p>
                </div>
              </Section>

              <Section id="numerazione" title="Numerazione preventivi" icon={Hash}>
                <div className="space-y-1.5">
                  <Label>Prefisso codice (max 6 caratteri)</Label>
                  <Input
                    {...register("quotePrefix")}
                    placeholder="PREV"
                    className="font-mono uppercase max-w-32"
                    maxLength={6}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      setValue("quotePrefix", v);
                    }}
                  />
                  {errors.quotePrefix && (
                    <p className="text-xs text-destructive">{errors.quotePrefix.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Anteprima:{" "}
                    <span className="font-mono font-semibold">
                      {watchedPrefix || "PREV"}-{new Date().getFullYear()}-001
                    </span>
                  </p>
                </div>
                <div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => setShowResetConfirm(true)}>
                    Reset contatore anno corrente
                  </Button>
                  {showResetConfirm && (
                    <div className="mt-3 p-3 border border-destructive/50 rounded-lg bg-destructive/5 space-y-2">
                      <div className="flex items-start gap-2 text-sm text-destructive">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>Resettando il contatore, il prossimo preventivo avrà il numero 001. Operazione non annullabile.</p>
                      </div>
                      <p className="text-sm font-medium">Digita RESET per confermare:</p>
                      <div className="flex gap-2">
                        <Input
                          value={resetConfirmText}
                          onChange={(e) => setResetConfirmText(e.target.value)}
                          placeholder="RESET"
                          className="font-mono max-w-32 h-8"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={resetConfirmText !== "RESET" || resetting}
                          onClick={resetCounter}
                        >
                          {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Conferma"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setShowResetConfirm(false); setResetConfirmText(""); }}>
                          Annulla
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              <Section id="team" title="Notifiche del team" icon={BellRing}>
                <p className="text-xs text-muted-foreground -mt-2">
                  Decidi quando avvisare <strong>tutto il team</strong> (notifica in-app + push). Vale per tutti gli utenti.
                </p>
                <div className="space-y-3">
                  <SettingToggle
                    checked={notifyAccept}
                    onChange={(v) => setValue("notifyTeamOnAccept", v, { shouldDirty: true })}
                    title="Avvisa il team quando un preventivo è accettato"
                    description="Tutti gli utenti ricevono la notifica appena un cliente firma e accetta."
                  />
                  <div className="border-t" />
                  <SettingToggle
                    checked={notifyReject}
                    onChange={(v) => setValue("notifyTeamOnReject", v, { shouldDirty: true })}
                    title="Avvisa il team quando un preventivo è rifiutato"
                    description="Se disattivo, il rifiuto avvisa solo il titolare del preventivo e gli admin."
                  />
                </div>
                <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-3 mt-2">
                  <SettingToggle
                    checked={aiEnabled}
                    onChange={(v) => setValue("aiEnabled", v, { shouldDirty: true })}
                    title="Assistente AI attivo per tutto il team"
                    description="Interruttore generale: se disattivo, chat AI, ricerca e suggerimenti prezzo sono bloccati per tutti."
                  />
                </div>
              </Section>

              <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salva impostazioni azienda
              </Button>
            </form>
          )}

          {/* Versione app (come da mobile) */}
          <div className="pt-2 pb-6 text-center lg:hidden">
            <p className="text-xs text-muted-foreground">
              Dieffe Preventivi · v{APP_VERSION}
            </p>
          </div>
        </div>
      </div>

      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
    </div>
  );
}
