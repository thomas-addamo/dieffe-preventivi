"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  LayoutTemplate,
  FilePlus2,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { calcItemTotal } from "@/lib/calculations";
import type { QuoteTemplate } from "@/lib/db/schema";
import type { TemplateData } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";

const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

export function TemplateClient({
  initialTemplates,
}: {
  initialTemplates: QuoteTemplate[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const { can: perms } = usePermissions();

  async function deleteTemplate(id: string) {
    if (!confirm("Eliminare questo template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template eliminato");
    }
  }

  async function useTemplate(id: string) {
    setUsingId(id);
    const res = await fetch(`/api/templates/${id}/use`, { method: "POST" });
    if (res.ok) {
      const { id: quoteId } = await res.json();
      toast.success("Preventivo creato dal template");
      router.push(`/preventivi/${quoteId}`);
    } else {
      toast.error("Errore nella creazione del preventivo");
      setUsingId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold lg:text-xl lg:font-semibold">Template</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Strutture riusabili di sezioni e voci. Usa un template per creare un
          nuovo preventivo già precompilato, poi personalizzalo.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="border rounded-xl p-16 text-center max-w-xl mx-auto">
          <LayoutTemplate className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h3 className="font-medium mb-1">Nessun template</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            I template si creano dall&apos;editor di un preventivo: apri un
            preventivo, vai su una sezione e usa &quot;Salva come template&quot;.
            Lo ritroverai qui per creare nuovi preventivi in un clic.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {templates.map((t) => {
            const data = t.data as TemplateData;
            const sections = data.sections ?? [];
            const sectionCount = sections.length;
            const itemCount = sections.reduce(
              (sum, s) => sum + (s.items?.length ?? 0),
              0
            );
            const estTotal = sections.reduce(
              (sum, s) =>
                sum +
                (s.items ?? []).reduce(
                  (acc, it) =>
                    acc + calcItemTotal(it.quantity ?? 1, it.unitPrice ?? 0, it.discount ?? 0),
                  0
                ),
              0
            );
            const expanded = expandedId === t.id;

            return (
              <div
                key={t.id}
                className="bg-card border rounded-xl p-4 flex flex-col transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{t.name}</h3>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>
                  {perms.manageTemplates && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => deleteTemplate(t.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {sectionCount} sezion{sectionCount === 1 ? "e" : "i"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {itemCount} voc{itemCount === 1 ? "e" : "i"}
                  </Badge>
                  {estTotal > 0 && (
                    <Badge variant="outline" className="text-xs font-mono">
                      ≈ {eur(estTotal)}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(t.createdAt)}
                  </span>
                </div>

                {/* Anteprima espandibile */}
                {sectionCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown
                      className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")}
                    />
                    {expanded ? "Nascondi" : "Anteprima contenuto"}
                  </button>
                )}
                {expanded && (
                  <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3 max-h-64 overflow-y-auto">
                    {sections.map((s, i) => (
                      <div key={i}>
                        <p className="text-xs font-semibold">
                          {s.code ? `${s.code} · ` : ""}
                          {s.title || "Sezione"}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {(s.items ?? []).map((it, j) => (
                            <li
                              key={j}
                              className="text-xs text-muted-foreground flex justify-between gap-2"
                            >
                              <span className="truncate">
                                {it.description || "—"}{" "}
                                <span className="opacity-60">
                                  ({it.quantity ?? 1} {it.unitOfMeasure || "n°"})
                                </span>
                              </span>
                              <span className="font-mono shrink-0">
                                {eur(calcItemTotal(it.quantity ?? 1, it.unitPrice ?? 0, it.discount ?? 0))}
                              </span>
                            </li>
                          ))}
                          {(s.items?.length ?? 0) === 0 && (
                            <li className="text-xs text-muted-foreground/60">Nessuna voce</li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* Azione principale */}
                {perms.createQuote && (
                  <Button
                    className="mt-3 gap-2 w-full"
                    disabled={usingId === t.id}
                    onClick={() => useTemplate(t.id)}
                  >
                    {usingId === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FilePlus2 className="w-4 h-4" />
                    )}
                    Nuovo preventivo da questo template
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
