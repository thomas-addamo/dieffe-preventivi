"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SectionWithItems } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatCurrency,
  PAYMENT_TERMS_TEMPLATES,
  VAT_RATES,
} from "@/lib/utils";

type QuoteTotals = {
  sectionSubtotals: { sectionId: string; code: string; title: string; subtotal: number }[];
  baseSubtotal: number;
  optionalSections: { sectionId: string; code: string; title: string; subtotal: number; isIncluded: boolean }[];
  optionalIncludedSubtotal: number;
  subtotalBeforeDiscount: number;
  discountAmount: number;
  taxableAmount: number;
  vatAmount: number;
  total: number;
  subtotal: number;
};

interface TotalsPanelProps {
  sections: SectionWithItems[];
  vatRate: number;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number | null;
  paymentTerms?: string | null;
  totals: QuoteTotals;
  onChangeVat: (rate: number) => void;
  onChangeDiscount: (type: "percent" | "fixed" | null, value: number | null) => void;
  onChangePaymentTerms: (terms: string) => void;
  onToggleOptionalIncluded: (sectionId: string, value: boolean) => void;
}

export function TotalsPanel({
  sections,
  vatRate,
  discountType,
  discountValue,
  paymentTerms,
  totals,
  onChangeVat,
  onChangeDiscount,
  onChangePaymentTerms,
  onToggleOptionalIncluded,
}: TotalsPanelProps) {
  const { isViewer } = usePermissions();
  const hasOptional = totals.optionalSections.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Riepilogo</h3>

      {/* Normal section subtotals */}
      {totals.sectionSubtotals.length > 0 && (
        <div className="space-y-1.5">
          {hasOptional && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Sezioni principali
            </p>
          )}
          {totals.sectionSubtotals.map((s) => (
            <div key={s.sectionId} className="flex justify-between text-xs">
              <span className="text-muted-foreground truncate max-w-36">
                {s.code} — {s.title}
              </span>
              <span className="tabular-nums font-medium">
                {formatCurrency(s.subtotal)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Optional sections */}
      {hasOptional && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-violet-500 uppercase tracking-wide mb-1">
              Sezioni opzionali
            </p>
            {totals.optionalSections.map((s) => (
              <div key={s.sectionId} className="flex items-center gap-2 text-xs">
                <Checkbox
                  id={`totals-inc-${s.sectionId}`}
                  checked={s.isIncluded}
                  onCheckedChange={(v) => onToggleOptionalIncluded(s.sectionId, !!v)}
                  disabled={isViewer}
                  className="h-3.5 w-3.5 shrink-0 border-violet-400 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                />
                <label
                  htmlFor={`totals-inc-${s.sectionId}`}
                  className={`flex-1 truncate cursor-pointer ${s.isIncluded ? "text-foreground" : "text-violet-400"}`}
                >
                  {s.code} — {s.title}
                </label>
                <span className={`tabular-nums font-medium shrink-0 ${s.isIncluded ? "" : "text-violet-400"}`}>
                  {formatCurrency(s.subtotal)}
                </span>
              </div>
            ))}
            {totals.optionalIncludedSubtotal > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                <span>Opzionali incluse</span>
                <span className="tabular-nums">{formatCurrency(totals.optionalIncludedSubtotal)}</span>
              </div>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotale</span>
        <span className="tabular-nums font-medium">
          {formatCurrency(totals.subtotalBeforeDiscount)}
        </span>
      </div>

      {/* Discount */}
      <div className="space-y-2">
        <Label className="text-xs">Sconto generale</Label>
        <div className="flex gap-2">
          <Select
            value={discountType ?? "none"}
            onValueChange={(v) => {
              if (v === "none") onChangeDiscount(null, null);
              else onChangeDiscount(v as "percent" | "fixed", discountValue ?? 0);
            }}
            disabled={isViewer}
          >
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">Nessuno</SelectItem>
              <SelectItem value="percent" className="text-xs">%</SelectItem>
              <SelectItem value="fixed" className="text-xs">€ fisso</SelectItem>
            </SelectContent>
          </Select>
          {discountType && (
            <Input
              type="number"
              value={discountValue ?? 0}
              onChange={(e) => onChangeDiscount(discountType, Number(e.target.value))}
              disabled={isViewer}
              className="flex-1 h-7 text-xs text-right"
              min="0"
              step="0.01"
            />
          )}
        </div>
        {totals.discountAmount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Sconto</span>
            <span className="tabular-nums text-destructive">
              -{formatCurrency(totals.discountAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Taxable */}
      {totals.discountAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Imponibile</span>
          <span className="tabular-nums font-medium">
            {formatCurrency(totals.taxableAmount)}
          </span>
        </div>
      )}

      {/* VAT */}
      <div className="space-y-2">
        <Label className="text-xs">IVA</Label>
        <Select
          value={String(vatRate)}
          onValueChange={(v) => onChangeVat(Number(v))}
          disabled={isViewer}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0" className="text-xs">Esente (0%)</SelectItem>
            <SelectItem value="4" className="text-xs">Ridotta (4%)</SelectItem>
            <SelectItem value="10" className="text-xs">Agevolata (10%)</SelectItem>
            <SelectItem value="22" className="text-xs">Ordinaria (22%)</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>IVA {vatRate}%</span>
          <span className="tabular-nums">{formatCurrency(totals.vatAmount)}</span>
        </div>
      </div>

      <Separator />

      {/* Total */}
      <div className="flex justify-between items-center py-1">
        <span className="font-semibold">TOTALE</span>
        <span className="text-xl font-bold tabular-nums">
          {formatCurrency(totals.total)}
        </span>
      </div>

      <Separator />

      {/* Payment terms */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Condizioni di pagamento</Label>
          {!isViewer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">
                  Template <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {PAYMENT_TERMS_TEMPLATES.map((t) => (
                  <DropdownMenuItem
                    key={t}
                    onClick={() => onChangePaymentTerms(t)}
                    className="text-xs whitespace-normal"
                  >
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <Textarea
          value={paymentTerms ?? ""}
          onChange={(e) => onChangePaymentTerms(e.target.value)}
          readOnly={isViewer}
          placeholder="Condizioni di pagamento..."
          rows={3}
          className="text-xs resize-none"
        />
      </div>
    </div>
  );
}
