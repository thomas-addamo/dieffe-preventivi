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
import { Loader2, Save, Upload, X, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CompanySettings } from "@/lib/db/schema";

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
});

type FormData = z.infer<typeof schema>;

export function ImpostazioniClient({
  initialSettings,
}: {
  initialSettings: CompanySettings | null;
}) {
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
    },
  });

  const watchedPrefix = watch("quotePrefix") ?? "PREV";

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
      setLogoPath(p + "?t=" + Date.now()); // bust cache
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

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Impostazioni azienda</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Questi dati appaiono nell'intestazione di tutti i preventivi
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Logo */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-sm">Logo aziendale</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Appare nell'intestazione dei PDF. Formati: PNG, JPG, WEBP, SVG — max 2MB.
          </p>
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
              {logoPath && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive text-xs"
                  onClick={removeLogo}
                >
                  <X className="h-3.5 w-3.5" /> Rimuovi
                </Button>
              )}
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
        </div>

        {/* Azienda */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-sm">Dati azienda</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Ragione sociale *</Label>
              <Input
                {...register("companyName")}
                placeholder="Dieffe Ristrutturazioni"
              />
              {errors.companyName && (
                <p className="text-xs text-destructive">
                  {errors.companyName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>P.IVA</Label>
              <Input
                {...register("vatNumber")}
                placeholder="IT10908150013"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefono</Label>
              <Input {...register("phone")} placeholder="+39 011 ..." />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                {...register("email")}
                type="email"
                placeholder="impresa.dieffe@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sito web</Label>
              <Input
                {...register("website")}
                placeholder="diefferistrutturazioni.it"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Indirizzo</Label>
              <Input
                {...register("address")}
                placeholder="Via Roma 1, 10024 Moncalieri (TO)"
              />
            </div>
          </div>
        </div>

        {/* Preventivi */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-sm">Impostazioni preventivi</h2>
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
                <input
                  type="color"
                  {...register("primaryColor")}
                  className="h-9 w-14 rounded-md border cursor-pointer"
                />
                <Input
                  {...register("primaryColor")}
                  className="font-mono text-sm"
                  placeholder="#1e40af"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Colore accento</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  {...register("accentColor")}
                  className="h-9 w-14 rounded-md border cursor-pointer"
                />
                <Input
                  {...register("accentColor")}
                  className="font-mono text-sm"
                  placeholder="#059669"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Export path */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-sm">Cartella di salvataggio export</h2>
          <div className="space-y-1.5">
            <Label>Percorso cartella</Label>
            <Input
              {...register("defaultExportPath")}
              placeholder="/Users/nome/Documenti/Preventivi"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              I file esportati vengono salvati in questa cartella con naming
              automatico
            </p>
          </div>
        </div>

        {/* Email configuration */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-sm">Configurazione Email</h2>
          <div className="space-y-1.5">
            <Label>Indirizzo email mittente</Label>
            <Input
              {...register("emailFromAddress")}
              type="email"
              placeholder="preventivi@tuaazienda.it"
            />
            {errors.emailFromAddress && (
              <p className="text-xs text-destructive">
                {errors.emailFromAddress.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Usato come mittente per le email di conferma firma inviate ai clienti. Deve essere un dominio verificato su Resend.
            </p>
          </div>
        </div>

        {/* Numerazione preventivi */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-sm">Numerazione preventivi</h2>
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
              Anteprima: <span className="font-mono font-semibold">{watchedPrefix || "PREV"}-{new Date().getFullYear()}-001</span>
            </p>
          </div>
          <div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset contatore anno corrente
            </Button>
            {showResetConfirm && (
              <div className="mt-3 p-3 border border-destructive/50 rounded-lg bg-destructive/5 space-y-2">
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Resettando il contatore, il prossimo preventivo avrà il numero 001. Questa operazione non può essere annullata.</p>
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
        </div>

        {/* AI Settings */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" /> Intelligenza Artificiale
          </h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Preferenze AI salvate nel browser (per utente/dispositivo).
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Suggerimenti AI automatici</p>
                <p className="text-xs text-muted-foreground">Suggerisce U.M. e prezzo mentre scrivi la descrizione</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !aiSuggestEnabled;
                  setAiSuggestEnabled(next);
                  localStorage.setItem("ai_suggestions_enabled", String(next));
                  toast.success(next ? "Suggerimenti AI attivati" : "Suggerimenti AI disattivati");
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiSuggestEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiSuggestEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Miglioramento automatico descrizione</p>
                <p className="text-xs text-muted-foreground">Migliora automaticamente dopo 3s di inattività</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !aiAutoImprove;
                  setAiAutoImprove(next);
                  localStorage.setItem("ai_auto_improve", String(next));
                  toast.success(next ? "Auto-miglioramento attivato" : "Auto-miglioramento disattivato");
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiAutoImprove ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiAutoImprove ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salva impostazioni
        </Button>
      </form>
    </div>
  );
}
