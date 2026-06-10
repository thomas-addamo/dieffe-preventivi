"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit2, Trash2, Loader2, Shield, User, Eye, EyeOff, Clock, UserCheck, Wand2, Copy, Check, Info } from "lucide-react";
import { ROLES } from "@/lib/permissions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "@/components/shared/PasswordStrengthMeter";
import { passwordSchema, generateStrongPassword } from "@/lib/password-policy";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

function RoleBadge({ role, size = "md" }: { role: string; size?: "sm" | "md" }) {
  const cfg =
    role === "admin"
      ? { cls: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", Icon: Shield, label: "Admin" }
      : role === "editor"
      ? { cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", Icon: User, label: "Editor" }
      : { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", Icon: Eye, label: "Viewer" };
  const iconSize = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";
  const textSize = size === "sm" ? "text-xs" : "";
  return (
    <Badge variant="secondary" className={`${cfg.cls} ${textSize}`}>
      <cfg.Icon className={`${iconSize} mr-1`} />
      {cfg.label}
    </Badge>
  );
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(["admin", "editor", "viewer"]),
});

const editSchema = z.object({
  name: z.string().min(2),
  role: z.enum(["admin", "editor", "viewer"]),
  password: passwordSchema.optional().or(z.literal("")),
});

type AccessLogEntry = {
  id: string;
  loginAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
};

function getBrowser(ua: string | null) {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 20);
}

function fmtDate(str: string | null) {
  if (!str) return "—";
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(str));
  } catch {
    return str;
  }
}

function daysSince(str: string | null) {
  if (!str) return null;
  const days = Math.floor((Date.now() - new Date(str).getTime()) / 86400000);
  if (days === 0) return "oggi";
  if (days === 1) return "ieri";
  return `${days} giorni fa`;
}

export function UtentiClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [accessLogUser, setAccessLogUser] = useState<UserRow | null>(null);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [accessLogLoading, setAccessLogLoading] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);

  async function showAccessLog(user: UserRow) {
    setAccessLogUser(user);
    setAccessLogLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}/access-log`);
    setAccessLogLoading(false);
    if (res.ok) setAccessLog(await res.json());
  }

  async function impersonate(userId: string) {
    setImpersonating(userId);
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setImpersonating(null);
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Errore durante l'impersonificazione");
    }
  }

  const createForm = useForm({ resolver: zodResolver(createSchema), defaultValues: { role: "editor" as const } });
  const editForm = useForm({ resolver: zodResolver(editSchema) });

  const createPassword = createForm.watch("password") ?? "";
  const editPassword = editForm.watch("password") ?? "";

  // Genera una password sicura, la inserisce nel campo indicato, la mostra in
  // chiaro (così l'admin può comunicarla) e la copia negli appunti.
  async function generateAndFill(target: "create" | "edit") {
    const pw = generateStrongPassword(16);
    if (target === "create") createForm.setValue("password", pw, { shouldValidate: true });
    else editForm.setValue("password", pw, { shouldValidate: true });
    setShowPw(true);
    try {
      await navigator.clipboard.writeText(pw);
      setCopiedPw(true);
      toast.success("Password generata e copiata negli appunti");
      setTimeout(() => setCopiedPw(false), 2000);
    } catch {
      toast.success("Password generata");
    }
  }

  async function copyPassword(target: "create" | "edit") {
    const pw = target === "create" ? createPassword : editPassword;
    if (!pw) return;
    try {
      await navigator.clipboard.writeText(pw);
      setCopiedPw(true);
      toast.success("Password copiata");
      setTimeout(() => setCopiedPw(false), 2000);
    } catch {
      toast.error("Impossibile copiare");
    }
  }

  async function onCreate(data: z.infer<typeof createSchema>) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { id } = await res.json();
      setUsers((prev) => [
        { id, ...data, disabled: false, createdAt: new Date().toISOString(), lastLoginAt: null },
        ...prev,
      ]);
      toast.success("Utente creato");
      setShowCreate(false);
      createForm.reset();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Errore");
    }
  }

  async function onEdit(data: z.infer<typeof editSchema>) {
    if (!editing) return;
    const body: Record<string, unknown> = { name: data.name, role: data.role };
    if (data.password) body.password = data.password;

    const res = await fetch(`/api/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id ? { ...u, name: data.name, role: data.role } : u
        )
      );
      toast.success("Utente aggiornato");
      setEditing(null);
    }
  }

  async function toggleDisabled(user: UserRow) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !user.disabled }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, disabled: !user.disabled } : u
        )
      );
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Eliminare questo utente?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("Utente eliminato");
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Errore");
    }
  }

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto pb-20 lg:pb-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Utenti</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Gestione accessi
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 hidden lg:flex">
          <Plus className="w-4 h-4" /> Nuovo utente
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Ultimo accesso</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-24">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(tu)</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}
                </TableCell>
                <TableCell>
                  {u.id !== currentUserId && (
                    <Switch checked={!u.disabled} onCheckedChange={() => toggleDisabled(u)} />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Storico accessi"
                      onClick={() => showAccessLog(u)}
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </Button>
                    {u.role !== "admin" && u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:text-blue-700"
                        title="Visualizza come"
                        disabled={impersonating === u.id}
                        onClick={() => impersonate(u.id)}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditing(u);
                        editForm.reset({ name: u.name, role: u.role as "admin" | "editor" | "viewer", password: "" });
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteUser(u.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="lg:hidden space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-card border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">(tu)</span>
                    )}
                  </p>
                  <RoleBadge role={u.role} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                {u.lastLoginAt && (
                  <p className="text-xs text-muted-foreground">
                    Accesso: {formatDate(u.lastLoginAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {u.id !== currentUserId && (
                  <Switch
                    checked={!u.disabled}
                    onCheckedChange={() => toggleDisabled(u)}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => {
                    setEditing(u);
                    editForm.reset({ name: u.name, role: u.role as "admin" | "editor" | "viewer", password: "" });
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                {u.id !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-destructive hover:text-destructive"
                    onClick={() => deleteUser(u.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAB — mobile only */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 z-40 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="Nuovo utente"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setShowPw(false); setCopiedPw(false); } }}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Nuovo utente</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input {...createForm.register("name")} placeholder="Mario Rossi" className="h-11 md:h-9 text-base md:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...createForm.register("email")} type="email" className="h-11 md:h-9 text-base md:text-sm" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Password temporanea</Label>
                <button
                  type="button"
                  onClick={() => generateAndFill("create")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Wand2 className="w-3 h-3" /> Genera sicura
                </button>
              </div>
              <div className="relative">
                <Input
                  {...createForm.register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="Minimo 8 caratteri"
                  className="pr-16 h-11 md:h-9 text-base md:text-sm font-mono"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {createPassword && (
                    <button
                      type="button"
                      onClick={() => copyPassword("create")}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                      tabIndex={-1}
                      aria-label="Copia"
                    >
                      {copiedPw ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    tabIndex={-1}
                    aria-label={showPw ? "Nascondi" : "Mostra"}
                  >
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              {createForm.formState.errors.password && (
                <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
              )}
              <PasswordStrengthMeter password={createPassword} />
              <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                L&apos;utente dovrà cambiarla al primo accesso.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select
                defaultValue="editor"
                onValueChange={(v) => createForm.setValue("role", v as "admin" | "editor" | "viewer")}
              >
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLES) as Array<keyof typeof ROLES>).map((r) => (
                    <SelectItem key={r} value={r}>
                      <div>
                        <span className="font-medium">{ROLES[r].label}</span>
                        <span className="block text-xs text-muted-foreground">{ROLES[r].description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="w-full sm:w-auto">
                Annulla
              </Button>
              <Button type="submit" disabled={createForm.formState.isSubmitting} className="w-full sm:w-auto">
                {createForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crea
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access log modal */}
      <Dialog open={!!accessLogUser} onOpenChange={(o) => !o && setAccessLogUser(null)}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>Storico accessi — {accessLogUser?.name}</DialogTitle>
          </DialogHeader>
          {accessLogUser && (
            <>
              {accessLogUser.lastLoginAt && (
                <p className="text-sm text-muted-foreground -mt-2">
                  Ultima connessione: {daysSince(accessLogUser.lastLoginAt)}
                </p>
              )}
              {accessLogLoading ? (
                <p className="text-sm text-center py-8 text-muted-foreground">Caricamento...</p>
              ) : accessLog.length === 0 ? (
                <p className="text-sm text-center py-8 text-muted-foreground">Nessun accesso registrato</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs">
                      <th className="text-left py-1">Data/Ora</th>
                      <th className="text-left py-1">IP</th>
                      <th className="text-left py-1">Browser</th>
                      <th className="text-center py-1">Esito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {accessLog.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-1.5">{fmtDate(entry.loginAt)}</td>
                        <td className="py-1.5 font-mono text-xs">{entry.ipAddress ?? "—"}</td>
                        <td className="py-1.5 text-xs">{getBrowser(entry.userAgent)}</td>
                        <td className="py-1.5 text-center">{entry.success ? "✅" : "❌"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setShowPw(false); setCopiedPw(false); } }}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Modifica utente</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input {...editForm.register("name")} className="h-11 md:h-9 text-base md:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select
                defaultValue={editing?.role ?? "editor"}
                onValueChange={(v) => editForm.setValue("role", v as "admin" | "editor" | "viewer")}
              >
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLES) as Array<keyof typeof ROLES>).map((r) => (
                    <SelectItem key={r} value={r}>
                      <div>
                        <span className="font-medium">{ROLES[r].label}</span>
                        <span className="block text-xs text-muted-foreground">{ROLES[r].description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Reimposta password</Label>
                <button
                  type="button"
                  onClick={() => generateAndFill("edit")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Wand2 className="w-3 h-3" /> Genera sicura
                </button>
              </div>
              <div className="relative">
                <Input
                  {...editForm.register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="Lascia vuoto per non cambiare"
                  className="pr-16 h-11 md:h-9 text-base md:text-sm font-mono"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {editPassword && (
                    <button
                      type="button"
                      onClick={() => copyPassword("edit")}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                      tabIndex={-1}
                      aria-label="Copia"
                    >
                      {copiedPw ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    tabIndex={-1}
                    aria-label={showPw ? "Nascondi" : "Mostra"}
                  >
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              {editForm.formState.errors.password && (
                <p className="text-xs text-destructive">{editForm.formState.errors.password.message}</p>
              )}
              <PasswordStrengthMeter password={editPassword} />
              {editPassword && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  L&apos;utente verrà disconnesso e dovrà cambiarla al prossimo accesso.
                </p>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} className="w-full sm:w-auto">
                Annulla
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting} className="w-full sm:w-auto">
                {editForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
