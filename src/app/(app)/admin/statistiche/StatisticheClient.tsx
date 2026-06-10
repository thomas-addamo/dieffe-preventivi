"use client";

import { useMemo, useState } from "react";
import { BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuoteData = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  clientName: string | null;
  authorName: string;
  authorId: string;
  total: number;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  accepted: "#22c55e",
  rejected: "#ef4444",
  archived: "#a78bfa",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  archived: "Archiviato",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" }).format(date);
}

const PERIOD_OPTIONS = [
  { label: "Ultimi 30 giorni", value: "30" },
  { label: "Ultimi 3 mesi", value: "90" },
  { label: "Ultimi 6 mesi", value: "180" },
  { label: "Ultimi 12 mesi", value: "365" },
  { label: "Tutto", value: "all" },
];

export function StatisticheClient({ quotes }: { quotes: QuoteData[] }) {
  const [period, setPeriod] = useState("365");

  const filtered = useMemo(() => {
    if (period === "all") return quotes;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(period));
    return quotes.filter((q) => new Date(q.createdAt) >= cutoff);
  }, [quotes, period]);

  // KPI
  const totalCount = filtered.length;
  const accepted = filtered.filter((q) => q.status === "accepted");
  const sent = filtered.filter((q) => ["sent", "accepted", "rejected"].includes(q.status));
  const totalAcceptedValue = accepted.reduce((s, q) => s + q.total, 0);
  const conversionRate = sent.length > 0 ? (accepted.length / sent.length) * 100 : 0;
  const avgValue = totalCount > 0 ? filtered.reduce((s, q) => s + q.total, 0) / totalCount : 0;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthCount = quotes.filter((q) => new Date(q.createdAt) >= thisMonthStart).length;
  const lastMonthCount = quotes.filter((q) => new Date(q.createdAt) >= lastMonthStart && new Date(q.createdAt) < thisMonthStart).length;
  const monthTrend = lastMonthCount > 0 ? ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100 : 0;

  // Monthly bar chart data (last 12 months max)
  const monthlyData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    const months: Date[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
      map.set(getMonthLabel(d), { draft: 0, sent: 0, accepted: 0, rejected: 0, archived: 0 });
    }
    for (const q of quotes) {
      const d = new Date(q.createdAt);
      const label = getMonthLabel(d);
      if (map.has(label)) {
        const entry = map.get(label)!;
        entry[q.status] = (entry[q.status] ?? 0) + 1;
      }
    }
    return months.map((d) => ({ month: getMonthLabel(d), ...map.get(getMonthLabel(d))! }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes]);

  // Monthly value line chart
  const monthlyValueData = useMemo(() => {
    const map = new Map<string, number>();
    const months: Date[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
      map.set(getMonthLabel(d), 0);
    }
    for (const q of quotes.filter((q) => q.status === "accepted")) {
      const d = new Date(q.updatedAt);
      const label = getMonthLabel(d);
      if (map.has(label)) map.set(label, (map.get(label) ?? 0) + q.total);
    }
    return months.map((d) => ({ month: getMonthLabel(d), valore: map.get(getMonthLabel(d)) ?? 0 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes]);

  // Pie chart data
  const statusDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of filtered) map.set(q.status, (map.get(q.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([status, value]) => ({ name: STATUS_LABELS[status] ?? status, value, status }));
  }, [filtered]);

  // Top 5 clients
  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const q of filtered.filter((q) => q.status === "accepted" && q.clientName)) {
      const key = q.clientName!;
      const e = map.get(key) ?? { name: key, value: 0 };
      e.value += q.total;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filtered]);

  // Top 5 users
  const topUsers = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const q of filtered) {
      const key = q.authorId;
      const e = map.get(key) ?? { name: q.authorName, count: 0 };
      e.count++;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filtered]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Statistiche</h1>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard label="Totale preventivi" value={totalCount.toString()} />
        <KpiCard label="Valore accettati" value={fmtCurrency(totalAcceptedValue)} />
        <KpiCard label="Tasso conversione" value={fmtPct(conversionRate)} />
        <KpiCard label="Valore medio" value={fmtCurrency(avgValue)} />
        <KpiCard
          label="Questo mese"
          value={thisMonthCount.toString()}
          sub={lastMonthCount > 0 ? `${monthTrend >= 0 ? "+" : ""}${fmtPct(monthTrend)} vs mese prec.` : undefined}
          subColor={monthTrend >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-4">Preventivi per mese (ultimi 12 mesi)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {["draft", "sent", "accepted", "rejected"].map((s) => (
                <Bar key={s} dataKey={s} name={STATUS_LABELS[s]} fill={STATUS_COLORS[s]} stackId="a" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-4">Valore mensile preventivi accettati</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyValueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
              <Line type="monotone" dataKey="valore" name="Valore (€)" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-4">Distribuzione stati</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {statusDist.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Top 5 clienti (per valore accettato)</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun dato</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr><th className="text-left py-1 font-medium text-muted-foreground">Cliente</th><th className="text-right py-1 font-medium text-muted-foreground">Valore</th></tr></thead>
              <tbody className="divide-y">
                {topClients.map((c) => (
                  <tr key={c.name}>
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 text-right font-medium">{fmtCurrency(c.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Top 5 utenti (per numero preventivi)</h2>
          {topUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun dato</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr><th className="text-left py-1 font-medium text-muted-foreground">Utente</th><th className="text-right py-1 font-medium text-muted-foreground">Preventivi</th></tr></thead>
              <tbody className="divide-y">
                {topUsers.map((u) => (
                  <tr key={u.name}>
                    <td className="py-2">{u.name}</td>
                    <td className="py-2 text-right font-medium">{u.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor ?? "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}
