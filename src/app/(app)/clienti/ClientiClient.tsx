"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit2, Trash2, Loader2, Building2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type { Client } from "@/lib/db/schema";
import { usePermissions } from "@/hooks/use-permissions";

const schema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function ClientiClient({
  initialClients,
}: {
  initialClients: Client[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { can: perms } = usePermissions();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const filtered = clients.filter((c) =>
    search
      ? c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
      : true
  );

  function openNew() {
    setEditing(null);
    reset({});
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    reset({
      name: client.name,
      address: client.address ?? "",
      vatNumber: client.vatNumber ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      notes: client.notes ?? "",
    });
    setShowForm(true);
  }

  async function onSubmit(data: FormData) {
    if (editing) {
      const res = await fetch(`/api/clients/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setClients((prev) =>
          prev.map((c) => (c.id === editing.id ? updated : c))
        );
        toast.success("Cliente aggiornato");
        setShowForm(false);
      }
    } else {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setClients((prev) => [created, ...prev]);
        toast.success("Cliente creato");
        setShowForm(false);
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Errore");
      }
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("Eliminare questo cliente?")) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      toast.success("Cliente eliminato");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl font-bold lg:text-xl lg:font-semibold">
            Clienti
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients.length} client{clients.length === 1 ? "e" : "i"} registrat{clients.length === 1 ? "o" : "i"}
          </p>
        </div>
        {perms.manageClients && (
          <>
            {/* Desktop: bottone esteso */}
            <Button onClick={openNew} className="gap-2 hidden lg:flex">
              <Plus className="w-4 h-4" /> Nuovo cliente
            </Button>
            {/* Mobile: bottone "+" compatto in stile iOS */}
            <button
              onClick={openNew}
              aria-label="Nuovo cliente"
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform active:scale-90"
            >
              <Plus className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca clienti..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 md:h-9 text-base md:text-sm"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Nome</TableHead>
              <TableHead>P.IVA / CF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Creato</TableHead>
              {perms.manageClients && <TableHead className="w-20">Azioni</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {search ? "Nessun cliente trovato" : "Nessun cliente ancora. Aggiungine uno!"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c, i) => (
                <TableRow key={c.id} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {c.vatNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  {perms.manageClients && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteClient(c.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="lg:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Building2 className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium text-foreground">
              {search ? "Nessun cliente trovato" : "Nessun cliente ancora"}
            </p>
            {!search && perms.manageClients && (
              <p className="text-sm">Tocca + in alto per aggiungerne uno</p>
            )}
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => perms.manageClients && openEdit(c)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-xs transition-all active:scale-[.98] active:bg-accent"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {c.name.trim().slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight truncate">{c.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {c.email && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </span>
                  )}
                  {c.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3 shrink-0" />
                      {c.phone}
                    </span>
                  )}
                  {!c.email && !c.phone && c.vatNumber && (
                    <span className="font-mono">{c.vatNumber}</span>
                  )}
                </div>
              </div>
              {perms.manageClients && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteClient(c.id);
                  }}
                  aria-label="Elimina cliente"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-destructive transition-colors active:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica cliente" : "Nuovo cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome / Ragione sociale *</Label>
              <Input {...register("name")} placeholder="Mario Rossi Srl" className="h-11 md:h-9 text-base md:text-sm" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>P.IVA / CF</Label>
                <Input {...register("vatNumber")} placeholder="IT..." className="font-mono h-11 md:h-9 text-base md:text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input {...register("phone")} placeholder="+39 ..." className="h-11 md:h-9 text-base md:text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register("email")} type="email" placeholder="cliente@email.com" className="h-11 md:h-9 text-base md:text-sm" />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Indirizzo</Label>
              <Input {...register("address")} placeholder="Via Roma 1, 10100 Torino" className="h-11 md:h-9 text-base md:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea {...register("notes")} rows={2} placeholder="Note interne..." />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="w-full sm:w-auto">
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Aggiorna" : "Crea cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
