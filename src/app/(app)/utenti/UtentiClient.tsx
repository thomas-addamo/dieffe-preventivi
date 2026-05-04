"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit2, Trash2, Loader2, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  password: z.string().min(8),
  role: z.enum(["admin", "user"]),
});

const editSchema = z.object({
  name: z.string().min(2),
  role: z.enum(["admin", "user"]),
  password: z.string().min(8).optional().or(z.literal("")),
});

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

  const createForm = useForm({ resolver: zodResolver(createSchema), defaultValues: { role: "user" as const } });
  const editForm = useForm({ resolver: zodResolver(editSchema) });

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
      <div className="hidden lg:block border rounded-lg overflow-hidden bg-card">
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
                  <Badge
                    variant="secondary"
                    className={
                      u.role === "admin"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }
                  >
                    {u.role === "admin" ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                    {u.role === "admin" ? "Admin" : "Utente"}
                  </Badge>
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
                      onClick={() => {
                        setEditing(u);
                        editForm.reset({ name: u.name, role: u.role as "admin" | "user", password: "" });
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
          <div key={u.id} className="bg-card border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">(tu)</span>
                    )}
                  </p>
                  <Badge
                    variant="secondary"
                    className={
                      u.role === "admin"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-xs"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 text-xs"
                    }
                  >
                    {u.role === "admin" ? <Shield className="w-2.5 h-2.5 mr-1" /> : <User className="w-2.5 h-2.5 mr-1" />}
                    {u.role === "admin" ? "Admin" : "Utente"}
                  </Badge>
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
                    editForm.reset({ name: u.name, role: u.role as "admin" | "user", password: "" });
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
      <Dialog open={showCreate} onOpenChange={(o) => !o && setShowCreate(false)}>
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
              <Label>Password temporanea</Label>
              <Input {...createForm.register("password")} type="password" placeholder="Minimo 8 caratteri" className="h-11 md:h-9 text-base md:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select
                defaultValue="user"
                onValueChange={(v) => createForm.setValue("role", v as "admin" | "user")}
              >
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
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
                defaultValue={editing?.role ?? "user"}
                onValueChange={(v) => editForm.setValue("role", v as "admin" | "user")}
              >
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nuova password (lascia vuoto per non cambiare)</Label>
              <Input {...editForm.register("password")} type="password" placeholder="Minimo 8 caratteri" className="h-11 md:h-9 text-base md:text-sm" />
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
