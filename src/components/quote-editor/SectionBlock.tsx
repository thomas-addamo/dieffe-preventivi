"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LineItem } from "./LineItem";
import type { SectionWithItems, ItemWithImages } from "@/types";
import { cn } from "@/lib/utils";

interface SectionBlockProps {
  section: SectionWithItems;
  sectionIndex: number;
  quoteId: string;
  onUpdate: (patch: Partial<SectionWithItems>) => void;
  onDelete: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, patch: Partial<ItemWithImages>) => void;
  onDeleteItem: (itemId: string) => void;
  onDuplicateItem: (itemId: string) => void;
}

export function SectionBlock({
  section,
  sectionIndex,
  quoteId,
  onUpdate,
  onDelete,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onDuplicateItem,
}: SectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 md:px-4 py-3 bg-blue-50/60 dark:bg-blue-950/20 border-b">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />

        <Input
          value={section.code}
          onChange={(e) => onUpdate({ code: e.target.value.toUpperCase().slice(0, 3) })}
          className="w-14 h-7 text-center font-mono font-bold bg-transparent border-none shadow-none focus-visible:ring-0 text-sm p-1"
        />

        <Input
          value={section.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="flex-1 h-7 font-semibold bg-transparent border-none shadow-none focus-visible:ring-0 text-sm min-w-0"
          placeholder="Titolo sezione"
        />

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (!confirm("Eliminare questa sezione e tutte le sue voci?")) return;
              onDelete();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>

        {/* Mobile kebab */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (!confirm("Eliminare questa sezione e tutte le sue voci?")) return;
                  onDelete();
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina sezione
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Column headers — desktop only */}
          {section.items.length > 0 && (
            <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_5.5rem_6rem_4rem_6rem_5.5rem] gap-1 px-4 py-1.5 bg-muted/30 text-xs font-medium text-muted-foreground border-b">
              <span>N.</span>
              <span>Descrizione</span>
              <span>U.M.</span>
              <span className="text-right">Qtà</span>
              <span className="text-right">Prezzo</span>
              <span className="text-right">Sc.%</span>
              <span className="text-right">Totale</span>
              <span />
            </div>
          )}

          {/* Mobile column hint */}
          {section.items.length > 0 && (
            <div className="md:hidden flex gap-2 px-3 py-1 bg-muted/30 text-xs text-muted-foreground border-b">
              <span className="w-16">U.M.</span>
              <span className="flex-1 text-center">Qtà</span>
              <span className="flex-1 text-center">Prezzo</span>
              <span className="flex-1 text-center">Sc.%</span>
            </div>
          )}

          {/* Items */}
          <div className="divide-y">
            {section.items.map((item, idx) => (
              <LineItem
                key={item.id}
                item={item}
                itemNumber={`${section.code}.${idx + 1}`}
                quoteId={quoteId}
                onUpdate={(patch) => onUpdateItem(item.id, patch)}
                onDelete={() => onDeleteItem(item.id)}
                onDuplicate={() => onDuplicateItem(item.id)}
              />
            ))}
          </div>

          {/* Add item */}
          <div className="px-3 md:px-4 py-2.5 border-t bg-muted/10">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddItem}
              className="gap-2 text-muted-foreground hover:text-foreground text-xs h-9 md:h-7"
            >
              <Plus className="w-3.5 h-3.5" /> Aggiungi voce
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
