"use client";

import { passwordStrength, validatePassword } from "@/lib/password-policy";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

const BAR_COLORS = [
  "bg-border", // 0 — vuoto
  "bg-red-500", // 1 — debole
  "bg-amber-500", // 2 — sufficiente
  "bg-blue-500", // 3 — buona
  "bg-emerald-500", // 4 — forte
] as const;

const TEXT_COLORS: Record<string, string> = {
  weak: "text-red-600 dark:text-red-400",
  fair: "text-amber-600 dark:text-amber-400",
  good: "text-blue-600 dark:text-blue-400",
  strong: "text-emerald-600 dark:text-emerald-400",
};

/**
 * Barra di robustezza + checklist requisiti, riusata sia nel cambio password
 * self-service sia nel reset admin. Si nasconde se il campo è vuoto.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { score, level, label } = passwordStrength(password);
  const { errors } = validatePassword(password);

  const requirements: { ok: boolean; text: string }[] = [
    { ok: password.length >= 8, text: "Almeno 8 caratteri" },
    { ok: /[a-zA-Z]/.test(password), text: "Una lettera" },
    { ok: /[0-9]/.test(password), text: "Un numero" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= score ? BAR_COLORS[score] : "bg-border"
              )}
            />
          ))}
        </div>
        {label && (
          <span className={cn("text-xs font-medium shrink-0", TEXT_COLORS[level])}>
            {label}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1">
        {requirements.map((r) => (
          <li
            key={r.text}
            className={cn(
              "flex items-center gap-1 text-[11px]",
              r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}
          >
            {r.ok ? (
              <Check className="w-3 h-3 shrink-0" />
            ) : (
              <X className="w-3 h-3 shrink-0" />
            )}
            {r.text}
          </li>
        ))}
      </ul>

      {errors.length === 0 && score < 3 && (
        <p className="text-[11px] text-muted-foreground">
          Suggerimento: allunga la password o aggiungi maiuscole e simboli per renderla più sicura.
        </p>
      )}
    </div>
  );
}
