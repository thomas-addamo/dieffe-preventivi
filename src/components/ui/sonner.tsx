"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "@/components/shared/ThemeProvider"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={{ "--width": "380px" } as React.CSSProperties}
      // iPhone (app installata): sotto tacca / Dynamic Island e sopra la tab bar
      mobileOffset={{
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
        left: "12px",
        right: "12px",
      }}
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          // Solo i toast "standard" (data-styled=true): le card personalizzate
          // (es. NotificationCard) gestiscono da sole sfondo, bordo e raggio.
          toast:
            "group toast group-[.toaster]:data-[styled=true]:bg-popover group-[.toaster]:data-[styled=true]:text-popover-foreground group-[.toaster]:data-[styled=true]:border-border/70 group-[.toaster]:data-[styled=true]:rounded-xl group-[.toaster]:data-[styled=true]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
