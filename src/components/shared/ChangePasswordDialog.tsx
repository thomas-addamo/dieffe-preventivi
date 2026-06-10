"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/shared/PasswordStrengthMeter";
import { passwordSchema } from "@/lib/password-policy";
import { toast } from "sonner";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Inserisci la password attuale"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Conferma la nuova password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "La nuova password deve essere diversa da quella attuale",
    path: ["newPassword"],
  });

type FormData = z.infer<typeof schema>;

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const newPassword = watch("newPassword") ?? "";

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        setError("currentPassword", { message: json.error ?? "Password attuale non corretta" });
      } else {
        toast.error(json.error ?? "Errore durante il cambio password");
      }
      return;
    }
    toast.success("Password aggiornata. Le altre sessioni sono state disconnesse.");
    reset();
    onOpenChange(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            Cambia password
          </DialogTitle>
          <DialogDescription>
            Per sicurezza, conferma la password attuale. Al salvataggio verrai
            disconnesso dagli altri dispositivi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Password attuale */}
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Password attuale</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10 h-11 md:h-10 text-base md:text-sm"
                {...register("currentPassword")}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showCurrent ? "Nascondi" : "Mostra"}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* Nuova password */}
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Nuova password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10 h-11 md:h-10 text-base md:text-sm"
                {...register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showNew ? "Nascondi" : "Mostra"}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
            <PasswordStrengthMeter password={newPassword} />
          </div>

          {/* Conferma */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Conferma nuova password</Label>
            <Input
              id="confirmPassword"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              className="h-11 md:h-10 text-base md:text-sm"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aggiorna password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
