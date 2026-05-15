"use client";

import { useRef, useState } from "react";
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
import { Loader2, Save, Upload, X } from "lucide-react";
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

  const {
    register,
    handleSubmit,
    setValue,
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
    },
  });

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
        <div className="bg-card border rounded-lg p-5 space-y-4">
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
        <div className="bg-card border rounded-lg p-5 space-y-4">
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
        <div className="bg-card border rounded-lg p-5 space-y-4">
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
                  className="h-9 w-14 rounded border cursor-pointer"
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
                  className="h-9 w-14 rounded border cursor-pointer"
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
        <div className="bg-card border rounded-lg p-5 space-y-4">
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
        <div className="bg-card border rounded-lg p-5 space-y-4">
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
