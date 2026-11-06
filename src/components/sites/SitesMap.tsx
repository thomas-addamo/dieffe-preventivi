"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Navigation, Phone } from "lucide-react";
import { HEALTH_COLORS, type SiteHealth } from "@/lib/sites/metrics";
import { formatCurrency } from "@/lib/utils";
import { HealthBadge, ProgressBar, directionsUrl, formatShortDate, siteTitle, useAppleDevice } from "./site-ui";

// ─────────────────────────────────────────────────────────────────────────────
// Mappa dei cantieri (OpenStreetMap: gratuita, senza chiavi; scura in tema
// scuro). Un segnaposto per cantiere con l'avanzamento %, colorato secondo lo
// stato; grigio = preventivo solo inviato. Caricata solo nel browser.
// ─────────────────────────────────────────────────────────────────────────────

export type MapSite = {
  id: string;
  name: string;
  status: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  clientName: string | null;
  clientPhone: string | null;
  quotes: { id: string; code: string; title: string; kind: string; net: number }[];
  metrics: { progress: number; health: SiteHealth; contractNet: number; toInvoice: number; expectedProgress: number | null };
  nextEvent: { date: string; title: string } | null;
};

const MONCALIERI: [number, number] = [45.0, 7.68];

function pinIcon(site: MapSite, selected: boolean) {
  const color = HEALTH_COLORS[site.metrics.health];
  const pending = site.status === "pending";
  const label = pending ? "" : `${Math.round(site.metrics.progress)}`;
  const size = selected ? 40 : 34;
  return L.divIcon({
    className: "site-pin",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 6],
    popupAnchor: [0, -size],
    html: `<div class="site-pin__body${selected ? " is-selected" : ""}" style="--pin:${color};width:${size}px;height:${size}px">
      <span>${pending ? "•" : label}</span></div><div class="site-pin__tip" style="--pin:${color}"></div>`,
  });
}

function FitBounds({ points, selected }: { points: [number, number][]; selected: [number, number] | null }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (selected) {
      map.flyTo(selected, Math.max(map.getZoom(), 14), { duration: 0.6 });
      return;
    }
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  }, [map, points, selected]);
  return null;
}

export default function SitesMap({
  sites,
  selectedId,
  onSelect,
  className,
}: {
  sites: MapSite[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const located = useMemo(() => sites.filter((s) => s.lat != null && s.lng != null), [sites]);
  const points = useMemo(() => located.map((s) => [s.lat!, s.lng!] as [number, number]), [located]);
  const sel = located.find((s) => s.id === selectedId);
  const markers = useRef(new Map<string, L.Marker>());
  const apple = useAppleDevice();

  useEffect(() => {
    if (selectedId) markers.current.get(selectedId)?.openPopup();
  }, [selectedId]);

  return (
    <MapContainer center={MONCALIERI} zoom={11} scrollWheelZoom className={className} attributionControl>
      {/* Mappa standard OpenStreetMap: gratuita e senza chiavi. In tema scuro
          la rende scura il CSS (.dark .leaflet-tile-pane). */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds points={points} selected={sel ? [sel.lat!, sel.lng!] : null} />
      {located.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat!, s.lng!]}
          icon={pinIcon(s, s.id === selectedId)}
          zIndexOffset={s.id === selectedId ? 1000 : s.status === "pending" ? -100 : 0}
          ref={(m) => {
            if (m) markers.current.set(s.id, m);
            else markers.current.delete(s.id);
          }}
          eventHandlers={{ click: () => onSelect?.(s.id) }}
        >
          <Popup minWidth={240} maxWidth={280}>
            <div className="space-y-2 text-foreground">
              <div>
                <p className="text-sm font-semibold leading-snug">{siteTitle(s.name)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.clientName ?? "Nessun cliente"} · {s.address}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <HealthBadge health={s.metrics.health} />
                {s.status === "active" && <span className="text-sm font-semibold tabular-nums">{Math.round(s.metrics.progress)}%</span>}
              </div>
              {s.status === "active" && (
                <ProgressBar value={s.metrics.progress} expected={s.metrics.expectedProgress} health={s.metrics.health} />
              )}
              <div className="space-y-0.5 text-xs text-muted-foreground">
                {s.quotes.map((q) => (
                  <Link key={q.id} href={`/preventivi/${q.id}`} className="flex justify-between gap-2 hover:text-primary">
                    <span className="truncate font-mono">{q.code}</span>
                    <span className="tabular-nums">{formatCurrency(q.net)}</span>
                  </Link>
                ))}
                {s.metrics.toInvoice > 0 && (
                  <p className="font-medium text-amber-600 dark:text-amber-400">Da fatturare: {formatCurrency(s.metrics.toInvoice)}</p>
                )}
                {s.nextEvent && (
                  <p>
                    {formatShortDate(s.nextEvent.date)} · {s.nextEvent.title}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 pt-1">
                <a
                  href={directionsUrl(s.lat, s.lng, s.address, apple)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium !text-primary-foreground"
                >
                  <Navigation className="h-3.5 w-3.5" /> Indicazioni
                </a>
                {s.clientPhone && (
                  <a
                    href={`tel:${s.clientPhone}`}
                    className="inline-flex items-center justify-center rounded-lg border px-2 py-1.5 text-xs"
                    aria-label="Chiama il cliente"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                <Link
                  href={`/cantieri/${s.id}`}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-medium !text-foreground"
                >
                  Apri cantiere
                </Link>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
