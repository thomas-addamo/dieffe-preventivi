import { cn } from "@/lib/utils";

interface MobilePageProps {
  title: string;
  subtitle?: string;
  /** Azione a destra del titolo (es. bottone) */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Contenitore pagina in stile iOS "large title" — solo per la shell mobile.
 * Le pagine desktop continuano a usare i propri header.
 */
export function MobilePage({
  title,
  subtitle,
  action,
  children,
  className,
}: MobilePageProps) {
  return (
    <div className={cn("px-4 pt-3", className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
      {children}
    </div>
  );
}
