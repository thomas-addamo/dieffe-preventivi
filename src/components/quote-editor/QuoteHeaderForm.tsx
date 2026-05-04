"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { QuoteWithRelations } from "@/types";

interface QuoteHeaderFormProps {
  quote: QuoteWithRelations;
  clients: { id: string; name: string }[];
  onChange: (patch: Partial<QuoteWithRelations>) => void;
}

export function QuoteHeaderForm({
  quote,
  clients,
  onChange,
}: QuoteHeaderFormProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between w-full px-5 py-3.5 hover:bg-muted/40 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="text-left">
          <h2 className="font-semibold text-sm">Intestazione preventivo</h2>
          {collapsed && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {quote.title} — {quote.code}
            </p>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 md:px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <Label>Titolo preventivo</Label>
            <Input
              value={quote.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Es: Ristrutturazione appartamento via Roma..."
              className="font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Codice</Label>
            <Input
              value={quote.code}
              readOnly
              className="bg-muted font-mono text-sm text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select
              value={quote.clientId ?? "none"}
              onValueChange={(v) =>
                onChange({ clientId: v === "none" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <Label>Indirizzo cantiere</Label>
            <Input
              value={quote.projectAddress ?? ""}
              onChange={(e) => onChange({ projectAddress: e.target.value })}
              placeholder="Via e numero civico, città"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Valido fino al</Label>
            <Input
              type="date"
              value={quote.validUntil ?? ""}
              onChange={(e) => onChange({ validUntil: e.target.value || null })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>IVA %</Label>
            <Select
              value={String(quote.vatRate)}
              onValueChange={(v) => onChange({ vatRate: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Esente (0%)</SelectItem>
                <SelectItem value="4">Ridotta (4%)</SelectItem>
                <SelectItem value="10">Agevolata (10%)</SelectItem>
                <SelectItem value="22">Ordinaria (22%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <Label>Note generali</Label>
            <Textarea
              value={quote.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Note aggiuntive per il preventivo..."
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}
