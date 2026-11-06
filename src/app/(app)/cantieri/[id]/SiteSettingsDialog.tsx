"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addWorkdays, isoDay, toDay } from "@/lib/sites/metrics";
import { siteKey, siteRequest, type SiteData } from "./site-api";

// Tempi e costi del cantiere: inizio/fine lavori, costo di un giorno di
// cantiere, penale, margine atteso. Con la sola data di inizio, la fine viene
// proposta dalla somma delle durate delle fasi (giorni lavorativi).

export function SiteSettingsDialog({ data, open, onOpenChange }: { data: SiteData; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const s = data.site;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: s.name,
    startDate: s.startDate ?? "",
    plannedEndDate: s.plannedEndDate ?? "",
    dailyCost: s.dailyCost?.toString() ?? "",
    penaltyPerDay: s.penaltyPerDay?.toString() ?? "",
    marginPct: s.marginPct.toString(),
  }));
  const totalDays = data.phases.reduce((a, p) => a + (p.durationDays ?? 1), 0);
  const suggestedEnd = form.startDate && totalDays > 0 ? isoDay(addWorkdays(toDay(form.startDate), totalDays - 1)) : null;

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim() || s.name,
        startDate: form.startDate || null,
        plannedEndDate: form.plannedEndDate || null,
        dailyCost: num(form.dailyCost),
        penaltyPerDay: num(form.penaltyPerDay),
        marginPct: num(form.marginPct) ?? 20,
      };
      // Inizio senza fine: la propone il programma delle fasi.
      if (form.startDate && !form.plannedEndDate) delete body.plannedEndDate;
      const updated = await siteRequest<SiteData>("PATCH", `/api/sites/${s.id}`, body);
      qc.setQueryData(siteKey(s.id), updated);
      qc.invalidateQueries({ queryKey: ["sites"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tempi e costi del cantiere</DialogTitle>
          <DialogDescription>Servono per il calendario e per calcolare quanto costa un eventuale ritardo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Nome del cantiere">
            <Input value={form.name} onChange={set("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inizio lavori">
              <Input type="date" value={form.startDate} onChange={set("startDate")} />
            </Field>
            <Field label="Fine prevista" hint={suggestedEnd && !form.plannedEndDate ? `Proposta: ${new Date(`${suggestedEnd}T00:00:00`).toLocaleDateString("it-IT")}` : undefined}>
              <Input type="date" value={form.plannedEndDate} min={form.startDate || undefined} onChange={set("plannedEndDate")} />
            </Field>
          </div>
          {suggestedEnd && form.plannedEndDate !== suggestedEnd && (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setForm({ ...form, plannedEndDate: suggestedEnd })}>
              Usa la fine calcolata dalle fasi ({totalDays} giorni lavorativi)
            </button>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Costo al giorno €" hint={s.dailyCost && s.dailyCost === Number(form.dailyCost) ? "Proposto dall'IA" : undefined}>
              <Input inputMode="decimal" value={form.dailyCost} onChange={set("dailyCost")} placeholder="es. 380" />
            </Field>
            <Field label="Penale/giorno €">
              <Input inputMode="decimal" value={form.penaltyPerDay} onChange={set("penaltyPerDay")} placeholder="0" />
            </Field>
            <Field label="Margine %">
              <Input inputMode="decimal" value={form.marginPct} onChange={set("marginPct")} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Costo al giorno = squadra in cantiere + noli (ponteggio, attrezzature) + suolo pubblico. La penale è quella del contratto, se prevista.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              Salva
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-primary">{hint}</span>}
    </label>
  );
}
