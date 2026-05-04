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
import { Upload, X, Loader2, Camera, ImageIcon } from "lucide-react";
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
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
            cloudinaryPublicId: uploaded.cloudinaryPublicId,
            cloudinaryUrl: uploaded.cloudinaryUrl,
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
      <DialogContent className="max-w-xl w-full">
        <DialogHeader>
          <DialogTitle>Immagini voce</DialogTitle>
        </DialogHeader>

        {/* Desktop drop zone */}
        <div
          className="hidden md:flex border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors flex-col items-center justify-center"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => galleryInputRef.current?.click()}
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
        </div>

        {/* Mobile upload buttons */}
        <div className="md:hidden grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="gap-2 h-14 flex-col text-xs"
            disabled={uploading}
            onClick={() => galleryInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            Da galleria
          </Button>
          <Button
            variant="outline"
            className="gap-2 h-14 flex-col text-xs"
            disabled={uploading}
            onClick={() => cameraInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            Scatta foto
          </Button>
        </div>

        {/* Hidden inputs */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {/* Gallery */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="group relative">
                <img
                  src={img.cloudinaryUrl}
                  alt={img.caption ?? img.cloudinaryPublicId}
                  className="w-full aspect-square object-cover rounded-lg border"
                />
                <button
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity md:p-0.5"
                  onClick={() => removeImage(img.id)}
                >
                  <X className="w-4 h-4 md:w-3.5 md:h-3.5" />
                </button>
                <Input
                  placeholder="Didascalia..."
                  value={img.caption ?? ""}
                  onChange={(e) => {
                    setImages((prev) =>
                      prev.map((i) =>
                        i.id === img.id ? { ...i, caption: e.target.value } : i
                      )
                    );
                  }}
                  className="mt-1.5 h-8 text-xs"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 md:flex-none">
            Annulla
          </Button>
          <Button onClick={handleSave} className="flex-1 md:flex-none">
            Salva immagini
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
