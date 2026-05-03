"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ItemWithImages } from "@/types";
import type { QuoteItemImage } from "@/lib/db/schema";

interface ImageUploaderProps {
  item: ItemWithImages;
  quoteId: string;
  onClose: () => void;
  onUpdate: (images: QuoteItemImage[]) => void;
}

export function ImageUploader({
  item,
  quoteId,
  onClose,
  onUpdate,
}: ImageUploaderProps) {
  const [images, setImages] = useState(item.images);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: file troppo grande (max 5MB)`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("quoteId", quoteId);
      fd.append("itemId", item.id);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const uploaded = await res.json();
        setImages((prev) => [
          ...prev,
          {
            id: uploaded.id,
            itemId: item.id,
            filename: uploaded.filename,
            path: uploaded.path,
            caption: null,
            orderIndex: prev.length,
          },
        ]);
      } else {
        const json = await res.json();
        toast.error(json.error ?? `Errore upload ${file.name}`);
      }
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function handleSave() {
    onUpdate(images);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Immagini voce</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                Trascina qui le immagini o clicca per selezionare
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WEBP — max 5MB per immagine
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* Gallery */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="group relative">
                <img
                  src={img.path}
                  alt={img.caption ?? img.filename}
                  className="w-full aspect-square object-cover rounded-lg border"
                />
                <button
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(img.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <Input
                  placeholder="Didascalia..."
                  value={img.caption ?? ""}
                  onChange={(e) => {
                    setImages((prev) =>
                      prev.map((i) =>
                        i.id === img.id
                          ? { ...i, caption: e.target.value }
                          : i
                      )
                    );
                  }}
                  className="mt-1.5 h-6 text-xs"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave}>Salva immagini</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
