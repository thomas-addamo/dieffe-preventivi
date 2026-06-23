'use client';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium shadow-md">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span>
          Modalità offline — Puoi visualizzare i preventivi già caricati.
          Le modifiche non saranno salvate finché non torni online.
        </span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded text-xs transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Riprova
      </button>
    </div>
  );
}
