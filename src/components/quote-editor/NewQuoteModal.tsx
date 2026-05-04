"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().min(1, "Titolo obbligatorio"),
  clientId: z.string().optional(),
  projectAddress: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface NewQuoteModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  clients: { id: string; name: string }[];
}

export function NewQuoteModal({
  open,
  onClose,
  onCreated,
  clients,
}: NewQuoteModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        clientId: data.clientId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Errore durante la creazione");
      return;
    }
    reset();
    onCreated(json.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Nuovo Preventivo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Titolo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Es: Ristrutturazione appartamento..."
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select onValueChange={(v) => setValue("clientId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona cliente (opzionale)" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="projectAddress">Indirizzo cantiere</Label>
            <Input
              id="projectAddress"
              placeholder="Via Roma 1, Torino"
              {...register("projectAddress")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Crea preventivo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
