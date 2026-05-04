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
    <div className="p-3 md:p-6 max-w-5xl mx-auto pb-20 lg:pb-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Clienti</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            {clients.length} client{clients.length === 1 ? "e" : "i"} registrat{clients.length === 1 ? "o" : "i"}
          </p>
        </div>
        {perms.manageClients && (
          <Button onClick={openNew} className="gap-2 hidden lg:flex">
            <Plus className="w-4 h-4" /> Nuovo cliente
          </Button>
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
      <div className="hidden lg:block border rounded-lg overflow-hidden bg-card">
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
      <div className="lg:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? "Nessun cliente trovato" : "Nessun cliente ancora."}
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="bg-card border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  {c.vatNumber && (
                    <p className="font-mono text-xs text-muted-foreground">{c.vatNumber}</p>
                  )}
                </div>
                {perms.manageClients && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEdit(c)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive hover:text-destructive"
                      onClick={() => deleteClient(c.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              {(c.email || c.phone) && (
                <div className="space-y-1">
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
            </div>
          ))
        )}
      </div>

      {perms.manageClients && (
        <button
          onClick={openNew}
          className="fixed bottom-6 right-6 z-40 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
          aria-label="Nuovo cliente"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

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
