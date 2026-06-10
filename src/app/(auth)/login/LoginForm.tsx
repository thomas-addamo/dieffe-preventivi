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

const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Minimo 8 caratteri"),
    confirmPassword: z.string().min(1, "Conferma la password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;
type ChangePasswordData = z.infer<typeof changePasswordSchema>;

export function LoginForm({ isFirstRun }: { isFirstRun: boolean }) {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "changePassword">(
    isFirstRun ? "register" : "login"
  );
  // Password temporanea usata al login: serve come "password attuale" per il
  // cambio obbligatorio.
  const [tempPassword, setTempPassword] = useState("");

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  const changePasswordForm = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
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
    if (json.mustChangePassword) {
      setTempPassword(data.password);
      setMode("changePassword");
      toast.info("Imposta una nuova password per continuare");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function onChangePassword(data: ChangePasswordData) {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: data.newPassword,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Errore durante il cambio password");
      return;
    }
    toast.success("Password aggiornata");
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

  if (mode === "changePassword") {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = changePasswordForm;
    return (
      <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
        <div>
          <h2 className="text-base font-semibold mb-1">Imposta una nuova password</h2>
          <p className="text-sm text-muted-foreground">
            La password assegnata è temporanea: scegline una nuova per continuare.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nuova password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPass ? "text" : "password"}
              placeholder="Minimo 8 caratteri"
              className="pr-10"
              {...register("newPassword")}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-xs text-destructive">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Conferma password</Label>
          <Input
            id="confirmPassword"
            type={showPass ? "text" : "password"}
            placeholder="Ripeti la nuova password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salva e continua
        </Button>
      </form>
    );
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
