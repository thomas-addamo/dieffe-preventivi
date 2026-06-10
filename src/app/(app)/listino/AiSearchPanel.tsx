"use client";

import { useState, useRef } from "react";
import { Sparkles, Search, Loader2, FileText, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface QuoteItemResult {
  description: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  total: number;
  quoteCode: string;
  quoteTitle: string;
  clientName: string | null;
  quoteDate: string | null;
  quoteStatus: string | null;
}

interface PriceListResult {
  description: string;
  unitOfMeasure: string;
  unitPrice: string;
  category: string | null;
}

interface SearchResults {
  quoteItems: QuoteItemResult[];
  listinoItems: PriceListResult[];
  summary: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  archived: "Archiviato",
};

export function AiSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(q = query) {
    if (!q.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) setResults(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  const hasResults =
    results && (results.quoteItems.length > 0 || results.listinoItems.length > 0);

  return (
    <div className="mb-5 border border-violet-200 dark:border-violet-800 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 p-3 md:p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
        <span className="text-sm font-medium text-violet-700 dark:text-violet-400">
          Ricerca AI — cerca nel listino e nella storia dei preventivi
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Es: cappotto termico, posa piastrelle, tinteggiatura..."
            className="pl-8 h-9 text-sm bg-card"
          />
        </div>
        <Button
          size="sm"
          className="h-9 bg-violet-600 hover:bg-violet-700"
          onClick={() => handleSearch()}
          disabled={!query.trim() || loading}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            "Cerca"
          )}
        </Button>
      </div>

      {/* AI Summary */}
      {results?.summary && (
        <div className="mt-3 bg-card border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2.5 text-xs text-violet-900 dark:text-violet-300 flex gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
          <p className="whitespace-pre-wrap">{results.summary}</p>
        </div>
      )}

      {results && !hasResults && !loading && (
        <p className="mt-3 text-xs text-muted-foreground text-center py-2">
          Nessun risultato trovato per &quot;{query}&quot;. Prova con termini diversi.
        </p>
      )}

      {hasResults && (
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          {/* Listino */}
          {results.listinoItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <List className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Listino prezzi ({results.listinoItems.length})
                </span>
              </div>
              <div className="space-y-1">
                {results.listinoItems.map((item, i) => (
                  <div
                    key={i}
                    className="bg-card border rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.description}</p>
                      {item.category && (
                        <p className="text-muted-foreground">{item.category}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">€{item.unitPrice}</p>
                      <p className="text-muted-foreground">{item.unitOfMeasure}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preventivi storici */}
          {results.quoteItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Preventivi storici ({results.quoteItems.length})
                </span>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {results.quoteItems.map((item, i) => (
                  <div
                    key={i}
                    className="bg-card border rounded-lg px-3 py-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium flex-1 min-w-0 truncate">
                        {item.description}
                      </p>
                      <p className="font-semibold shrink-0">
                        €{item.unitPrice}/{item.unitOfMeasure}
                      </p>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span>{item.quoteCode}</span>
                      {item.clientName && (
                        <>
                          <span>·</span>
                          <span>{item.clientName}</span>
                        </>
                      )}
                      {item.quoteDate && (
                        <>
                          <span>·</span>
                          <span>{item.quoteDate.substring(0, 10)}</span>
                        </>
                      )}
                      {item.quoteStatus && (
                        <span
                          className={`ml-auto px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${
                            item.quoteStatus === "accepted"
                              ? "bg-green-100 text-green-700"
                              : item.quoteStatus === "sent"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {STATUS_LABELS[item.quoteStatus] ?? item.quoteStatus}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      Qtà: {item.quantity} · Totale riga:{" "}
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
