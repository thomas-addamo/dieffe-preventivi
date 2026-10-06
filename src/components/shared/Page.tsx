import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Impaginazione comune a TUTTE le pagine dell'area riservata: stessi margini
// laterali, stessa larghezza massima, stesso titolo. Le pagine non devono
// definire padding/max-width propri: usano <Page> e <PageHeader>.
//
//   default → elenchi e dashboard (max 72rem)
//   narrow  → moduli e impostazioni (max 48rem)
// ─────────────────────────────────────────────────────────────────────────────

const WIDTHS = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
} as const;

export function Page({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-8 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8",
        WIDTHS[width],
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Icona opzionale accanto al titolo */
  icon?: React.ReactNode;
  /** Azioni a destra (bottoni). Su mobile restano a destra del titolo. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-3 md:mb-6", className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-[26px] font-bold leading-tight tracking-tight">
          {icon}
          <span className="min-w-0 break-words">{title}</span>
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Titolo di sezione dentro una pagina (sopra un gruppo di card). */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      {children}
    </h2>
  );
}

/** Stato vuoto uniforme. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-14 text-center text-muted-foreground",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Icon className="h-7 w-7 opacity-50" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm">{description}</p>}
      {action}
    </div>
  );
}
