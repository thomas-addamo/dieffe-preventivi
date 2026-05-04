"use client";

import { useRef, useState, useEffect } from "react";
import {
  GripVertical,
  Copy,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "./ImageUploader";
import type { ItemWithImages } from "@/types";
import { UNIT_OF_MEASURES, formatCurrency } from "@/lib/utils";

interface LineItemProps {
  item: ItemWithImages;
  itemNumber: string;
  quoteId: string;
  onUpdate: (patch: Partial<ItemWithImages>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function LineItem({
  item,
  itemNumber,
  quoteId,
  onUpdate,
  onDelete,
  onDuplicate,
}: LineItemProps) {
  const [showImages, setShowImages] = useState(false);
  const descDesktopRef = useRef<HTMLTextAreaElement>(null);
  const descMobileRef = useRef<HTMLTextAreaElement>(null);

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoResize(descDesktopRef.current);
    autoResize(descMobileRef.current);
  }, [item.description]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
    }
  }

  return (
    <>
      {/* ── Desktop layout (md+) ── */}
      <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_5.5rem_6rem_4rem_6rem_5.5rem] gap-1 px-4 py-2.5 hover:bg-muted/20 group items-start">
        {/* Drag + number */}
        <div className="flex items-center gap-1 pt-1.5">
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {itemNumber}
          </span>
        </div>

        {/* Description */}
        <div className="pt-0.5">
          <textarea
            ref={descDesktopRef}
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Descrizione voce..."
            rows={1}
            className="w-full resize-none bg-transparent text-sm outline-none focus:outline-none placeholder:text-muted-foreground/60 overflow-hidden leading-5 py-1"
          />
          {item.notes !== null && item.notes !== undefined && (
            <Input
              value={item.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Note..."
              className="mt-1 h-6 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 text-muted-foreground placeholder:text-muted-foreground/40"
            />
          )}
        </div>

        <Select value={item.unitOfMeasure} onValueChange={(v) => onUpdate({ unitOfMeasure: v })}>
          <SelectTrigger className="h-7 text-xs border-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OF_MEASURES.map((um) => (
              <SelectItem key={um} value={um} className="text-xs">{um}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Number(e.target.value) || 0 })}
          className="h-7 text-xs text-right tabular-nums border-muted"
          step="0.01"
        />

        <Input
          type="number"
          value={item.unitPrice}
          onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) || 0 })}
          className="h-7 text-xs text-right tabular-nums border-muted"
          step="0.01"
        />

        <Input
          type="number"
          value={item.discount}
          onChange={(e) => onUpdate({ discount: Number(e.target.value) || 0 })}
          className="h-7 text-xs text-right tabular-nums border-muted"
          step="0.5"
          min="0"
          max="100"
        />

        <div className="text-right pt-1.5">
          <span className="text-sm font-medium tabular-nums">
            {formatCurrency(item.total)}
          </span>
        </div>

        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 relative"
            onClick={() => setShowImages(true)}
          >
            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
            {item.images.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
                {item.images.length}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>

      {/* ── Mobile card layout (< md) ── */}
      <div className="md:hidden px-3 py-3 space-y-2.5 border-b last:border-b-0">
        {/* Row 1: number + description */}
        <div className="flex gap-2 items-start">
          <div className="flex items-center gap-1 pt-2 shrink-0">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab" />
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {itemNumber}
            </span>
          </div>
          <textarea
            ref={descMobileRef}
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Descrizione voce..."
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm outline-none focus:outline-none placeholder:text-muted-foreground/60 overflow-hidden leading-5 py-1.5 min-h-[44px]"
          />
        </div>

        {/* Row 2: U.M. | Qty | Prezzo | Sconto */}
        <div className="grid grid-cols-4 gap-2">
          <Select value={item.unitOfMeasure} onValueChange={(v) => onUpdate({ unitOfMeasure: v })}>
            <SelectTrigger className="h-10 text-xs border-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OF_MEASURES.map((um) => (
                <SelectItem key={um} value={um} className="text-xs">{um}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: Number(e.target.value) || 0 })}
            className="h-10 text-sm text-right tabular-nums border-muted"
            placeholder="Qtà"
            step="0.01"
          />
          <Input
            type="number"
            value={item.unitPrice}
            onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) || 0 })}
            className="h-10 text-sm text-right tabular-nums border-muted"
            placeholder="€"
            step="0.01"
          />
          <Input
            type="number"
            value={item.discount}
            onChange={(e) => onUpdate({ discount: Number(e.target.value) || 0 })}
            className="h-10 text-sm text-right tabular-nums border-muted"
            placeholder="Sc.%"
            step="0.5"
            min="0"
            max="100"
          />
        </div>

        {/* Row 3: total + actions */}
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold tabular-nums">
            {formatCurrency(item.total)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 relative"
              onClick={() => setShowImages(true)}
            >
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              {item.images.length > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
                  {item.images.length}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onDuplicate}>
              <Copy className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {showImages && (
        <ImageUploader
          item={item}
          quoteId={quoteId}
          onClose={() => setShowImages(false)}
          onUpdate={(images) => onUpdate({ images })}
        />
      )}
    </>
  );
}
