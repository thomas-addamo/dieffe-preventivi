"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionBlock } from "./SectionBlock";
import type { SectionWithItems, ItemWithImages } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";

interface SectionsDragListProps {
  sections: SectionWithItems[];
  quoteId: string;
  onSectionsReordered: (reordered: SectionWithItems[]) => void;
  onUpdateSection: (sectionId: string, patch: Partial<SectionWithItems>) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddItem: (sectionId: string) => void;
  onUpdateItem: (sectionId: string, itemId: string, patch: Partial<ItemWithImages>) => void;
  onDeleteItem: (sectionId: string, itemId: string) => void;
  onDuplicateItem: (sectionId: string, itemId: string) => void;
  onToggleOptionalIncluded: (sectionId: string, value: boolean) => void;
  onAddSection: (isOptional?: boolean) => void;
}

export function SectionsDragList({
  sections,
  quoteId,
  onSectionsReordered,
  onUpdateSection,
  onDeleteSection,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onDuplicateItem,
  onToggleOptionalIncluded,
  onAddSection,
}: SectionsDragListProps) {
  const { isViewer } = usePermissions();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex).map(
      (s, idx) => ({ ...s, orderIndex: idx })
    );
    onSectionsReordered(reordered);
  }

  const hasNormalSections = sections.some((s) => !s.isOptional);

  return (
    <div className="space-y-3 md:space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section, sIdx) => {
            const isFirstOptional =
              !!section.isOptional &&
              (sIdx === 0 || !sections[sIdx - 1].isOptional);

            return (
              <div key={section.id}>
                {isFirstOptional && hasNormalSections && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
                      Sezioni opzionali
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <SectionBlock
                  section={section}
                  sectionIndex={sIdx}
                  quoteId={quoteId}
                  onUpdate={(patch) => onUpdateSection(section.id, patch)}
                  onDelete={() => onDeleteSection(section.id)}
                  onAddItem={() => onAddItem(section.id)}
                  onUpdateItem={(itemId, patch) => onUpdateItem(section.id, itemId, patch)}
                  onDeleteItem={(itemId) => onDeleteItem(section.id, itemId)}
                  onDuplicateItem={(itemId) => onDuplicateItem(section.id, itemId)}
                  onToggleOptionalIncluded={(v) => onToggleOptionalIncluded(section.id, v)}
                />
              </div>
            );
          })}
        </SortableContext>
      </DndContext>

      {!isViewer && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onAddSection(false)}
            className="flex-1 gap-2 border-dashed text-muted-foreground hover:text-foreground h-11 md:h-9"
          >
            <Plus className="w-4 h-4" /> Aggiungi sezione
          </Button>
          <Button
            variant="outline"
            onClick={() => onAddSection(true)}
            className="flex-1 gap-2 border-dashed border-violet-300 text-violet-500 hover:text-violet-600 hover:border-violet-400 h-11 md:h-9"
          >
            <Plus className="w-4 h-4" /> Aggiungi sezione opzionale
          </Button>
        </div>
      )}
    </div>
  );
}
