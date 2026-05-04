"use client";

import { useState } from "react";
import { Trash2, LayoutTemplate, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { QuoteTemplate } from "@/lib/db/schema";
import type { TemplateData } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";

export function TemplateClient({
  initialTemplates,
}: {
  initialTemplates: QuoteTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const { can: perms } = usePermissions();

  async function deleteTemplate(id: string) {
    if (!confirm("Eliminare questo template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template eliminato");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Template</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sezioni e voci riusabili per velocizzare la creazione dei preventivi
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="border rounded-lg p-16 text-center">
          <LayoutTemplate className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h3 className="font-medium mb-1">Nessun template</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            I template si creano dall'editor preventivi: apri un preventivo, vai
            su una sezione e clicca "Salva come template".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => {
            const data = t.data as TemplateData;
            const sectionCount = data.sections?.length ?? 0;
            const itemCount =
              data.sections?.reduce(
                (sum, s) => sum + (s.items?.length ?? 0),
                0
              ) ?? 0;

            return (
              <div
                key={t.id}
                className="bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{t.name}</h3>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {sectionCount} sezion{sectionCount === 1 ? "e" : "i"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {itemCount} voc{itemCount === 1 ? "e" : "i"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(t.createdAt)}
                    </p>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
