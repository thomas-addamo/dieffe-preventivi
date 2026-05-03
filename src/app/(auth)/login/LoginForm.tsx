"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(1, "Password obbligatoria"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Nome troppo corto"),
  email: z.string().email("Email non valida"),
  password: z.string().min(8, "Minimo 8 caratteri"),
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export function LoginForm({ isFirstRun }: { isFirstRun: boolean }) {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(
    isFirstRun ? "register" : "login"
  );

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  async function onLogin(data: LoginData) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Errore di accesso");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function onRegister(data: RegisterData) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Errore durante la registrazione");
      return;
    }
    toast.success("Account creato, accesso in corso...");
    router.push("/dashboard");
    router.refresh();
  }

  if (mode === "register") {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = registerForm;
    return (
      <form onSubmit={handleSubmit(onRegister)} className="space-y-4">
        <div>
          <h2 className="text-base font-semibold mb-1">Crea account amministratore</h2>
          <p className="text-sm text-muted-foreground">
            Primo accesso — configura il tuo account
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" placeholder="Mario Rossi" {...register("name")} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="admin@azienda.it" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPass ? "text" : "password"}
              placeholder="Minimo 8 caratteri"
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crea account e accedi
        </Button>

        {!isFirstRun && (
          <button
            type="button"
            className="text-sm text-primary hover:underline w-full text-center"
            onClick={() => setMode("login")}
          >
            Hai già un account? Accedi
          </button>
        )}
      </form>
    );
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = loginForm;
  return (
    <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-1">Accedi</h2>
        <p className="text-sm text-muted-foreground">
          Inserisci le tue credenziali
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="email@azienda.it" {...register("email")} />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPass ? "text" : "password"}
            placeholder="••••••••"
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Accedi
      </Button>
    </form>
  );
}
