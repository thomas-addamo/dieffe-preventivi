"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Monitor, LogOut, User, ChevronDown, Menu, KeyRound, Bell, BellOff } from "lucide-react";
import { useTheme } from "@/components/shared/ThemeProvider";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { ChangePasswordDialog } from "@/components/shared/ChangePasswordDialog";
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
} from "@/lib/push-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface HeaderProps {
  userName: string;
  userEmail: string;
  title?: string;
  onMenuClick?: () => void;
}

export function Header({ userName, userEmail, title, onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    getPushState().then((s) => {
      setPushSupported(true);
      setPushEnabled(s.subscribed && s.permission === "granted");
    });
  }, []);

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast.success("Notifiche push disattivate");
      } else {
        const res = await subscribeToPush();
        if (res.ok) {
          setPushEnabled(true);
          toast.success("Notifiche push attivate 🔔");
        } else {
          toast.error(res.reason);
        }
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    toast.success("Disconnesso");
  }

  const ThemeIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — visible only on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:hidden"
          onClick={onMenuClick}
          aria-label="Apri menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="text-sm font-medium text-foreground">
          {title ?? "Dieffe Ristrutturazioni"}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Chiaro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Scuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-9 px-2 md:px-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="hidden sm:block text-sm font-medium max-w-32 truncate">
                {userName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
              <KeyRound className="mr-2 h-4 w-4" /> Cambia password
            </DropdownMenuItem>
            {pushSupported && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  togglePush();
                }}
                disabled={pushBusy}
              >
                {pushEnabled ? (
                  <>
                    <BellOff className="mr-2 h-4 w-4" /> Disattiva notifiche push
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" /> Attiva notifiche push
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </header>
  );
}
