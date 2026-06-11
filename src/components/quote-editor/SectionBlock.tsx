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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LineItem } from "./LineItem";
import type { SectionWithItems, ItemWithImages } from "@/types";
import type { PriceListItem } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

interface SectionBlockProps {
  section: SectionWithItems;
  sectionIndex: number;
  quoteId: string;
  priceListItems?: PriceListItem[];
  onUpdate: (patch: Partial<SectionWithItems>) => void;
  onDelete: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, patch: Partial<ItemWithImages>) => void;
  onDeleteItem: (itemId: string) => void;
  onDuplicateItem: (itemId: string) => void;
  onToggleOptionalIncluded: (value: boolean) => void;
}

export function SectionBlock({
  section,
  sectionIndex,
  quoteId,
  priceListItems = [],
  onUpdate,
  onDelete,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onDuplicateItem,
  onToggleOptionalIncluded,
}: SectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { isViewer } = usePermissions();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = section.items.findIndex((i) => i.id === active.id);
    const newIndex = section.items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(section.items, oldIndex, newIndex).map(
      (item, idx) => ({ ...item, orderIndex: idx })
    );

    onUpdate({ items: reordered });
    fetch(`/api/quotes/${quoteId}/items/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((i) => ({ id: i.id, orderIndex: i.orderIndex }))),
    }).catch(() => {});
  }

  const sectionStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOptional = !!section.isOptional;
  const isLumpSum = !!section.lumpSum;
  const itemsSubtotal = section.items.reduce((sum, i) => sum + i.total, 0);

  const headerBg = isOptional
    ? "bg-violet-50/80 dark:bg-violet-950/20 border-l-4 border-l-violet-400"
    : "bg-blue-50/60 dark:bg-blue-950/20";

  const kebabMenu = !isViewer && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
          <MoreVertical className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isOptional ? (
          <DropdownMenuItem
            onClick={() => onUpdate({ isOptional: true, isOptionalIncluded: false })}
          >
            Segna come opzionale
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => onUpdate({ isOptional: false, isOptionalIncluded: false })}
          >
            Rimuovi opzionale
          </DropdownMenuItem>
        )}
        {!isLumpSum ? (
          <DropdownMenuItem
            onClick={() => onUpdate({ lumpSum: true, lumpSumPrice: itemsSubtotal || null })}
          >
            Prezzo a corpo sezione
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => onUpdate({ lumpSum: false, lumpSumPrice: null })}
          >
            Rimuovi prezzo a corpo
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
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
  );

  return (
    <div ref={setNodeRef} style={sectionStyle} className="bg-card border rounded-xl overflow-hidden">
      {/* Section header */}
      <div className={cn("flex items-center gap-2 px-3 md:px-4 py-3 border-b", headerBg)}>
        <GripVertical
          {...(!isViewer ? { ...attributes, ...listeners } : {})}
          className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab"
        />

        <Input
          value={section.code}
          onChange={(e) => onUpdate({ code: e.target.value.toUpperCase().slice(0, 3) })}
          disabled={isViewer}
          className="w-14 h-7 text-center font-mono font-bold bg-transparent border-none shadow-none focus-visible:ring-0 text-sm p-1"
        />

        <Input
          value={section.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          disabled={isViewer}
          className="flex-1 h-7 font-semibold bg-transparent border-none shadow-none focus-visible:ring-0 text-sm min-w-0"
          placeholder="Titolo sezione"
        />

        {isOptional && (
          <span className="hidden sm:inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-xs font-medium bg-violet-100 text-violet-600">
            OPZIONALE
          </span>
        )}

        {isLumpSum && (
          <span className="hidden sm:inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            A CORPO
          </span>
        )}

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {isOptional && !isViewer && (
            <div className="flex items-center gap-1.5 mr-1">
              <Checkbox
                id={`inc-${section.id}`}
                checked={!!section.isOptionalIncluded}
                onCheckedChange={(v) => onToggleOptionalIncluded(!!v)}
                className="h-3.5 w-3.5 border-violet-400 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
              />
              <Label htmlFor={`inc-${section.id}`} className="text-xs text-violet-600 cursor-pointer whitespace-nowrap">
                Includi nel totale
              </Label>
            </div>
          )}
          {kebabMenu}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
          {!isViewer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOptional && (
                  <DropdownMenuItem
                    onClick={() => onToggleOptionalIncluded(!section.isOptionalIncluded)}
                  >
                    {section.isOptionalIncluded ? "Escludi dal totale" : "Includi nel totale"}
                  </DropdownMenuItem>
                )}
                {!isOptional ? (
                  <DropdownMenuItem
                    onClick={() => onUpdate({ isOptional: true, isOptionalIncluded: false })}
                  >
                    Segna come opzionale
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onUpdate({ isOptional: false, isOptionalIncluded: false })}
                  >
                    Rimuovi opzionale
                  </DropdownMenuItem>
                )}
                {!isLumpSum ? (
                  <DropdownMenuItem
                    onClick={() => onUpdate({ lumpSum: true, lumpSumPrice: itemsSubtotal || null })}
                  >
                    Prezzo a corpo sezione
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onUpdate({ lumpSum: false, lumpSumPrice: null })}
                  >
                    Rimuovi prezzo a corpo
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
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
          )}
        </div>
      </div>

      {/* Section note */}
      <div className={cn(
        "px-3 md:px-4 border-b",
        isOptional ? "bg-violet-50/40 dark:bg-violet-950/10" : "bg-blue-50/20 dark:bg-blue-950/10"
      )}>
        {isViewer ? (
          section.sectionNote ? (
            <p className="py-2 text-sm italic text-zinc-500">{section.sectionNote}</p>
          ) : null
        ) : (
          <Textarea
            value={section.sectionNote ?? ""}
            onChange={(e) => onUpdate({ sectionNote: e.target.value || null })}
            placeholder="Aggiungi una nota alla sezione (opzionale)"
            rows={1}
            className="min-h-[32px] resize-none bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:border-b focus-visible:border-zinc-300 text-sm italic text-zinc-500 placeholder:not-italic placeholder:text-zinc-400 py-2 px-0"
          />
        )}
      </div>

      {/* Lump-sum price row */}
      {isLumpSum && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 md:px-4 py-2 border-b bg-amber-50/60 dark:bg-amber-950/20">
          <Label
            htmlFor={`lump-${section.id}`}
            className="text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap"
          >
            Prezzo a corpo sezione (€)
          </Label>
          <Input
            id={`lump-${section.id}`}
            type="number"
            min={0}
            step="0.01"
            value={section.lumpSumPrice ?? ""}
            onChange={(e) =>
              onUpdate({
                lumpSumPrice: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            disabled={isViewer}
            className="w-32 h-8 text-right tabular-nums bg-background"
          />
          <span className="text-xs text-muted-foreground">
            Le voci elencate descrivono i lavori: i loro prezzi non concorrono al
            totale.
          </span>
        </div>
      )}

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
          <DndContext
            sensors={itemSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext
              items={section.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y">
                {section.items.map((item, idx) => (
                  <LineItem
                    key={item.id}
                    item={item}
                    itemNumber={`${section.code}.${idx + 1}`}
                    quoteId={quoteId}
                    priceListItems={priceListItems}
                    onUpdate={(patch) => onUpdateItem(item.id, patch)}
                    onDelete={() => onDeleteItem(item.id)}
                    onDuplicate={() => onDuplicateItem(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add item */}
          {!isViewer && (
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
          )}
        </>
      )}
    </div>
  );
}
