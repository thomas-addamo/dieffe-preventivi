'use client';
import { useState, useEffect } from 'react';
import { useElectron } from '@/hooks/use-electron';
import { Download, X } from 'lucide-react';

export function UpdateBanner() {
  const [updateState, setUpdateState] = useState<'none' | 'available' | 'downloaded'>('none');
  const { isElectron, electron } = useElectron();

  useEffect(() => {
    if (!isElectron || !electron) return;

    const cleanupAvailable = electron.onUpdateAvailable(() => setUpdateState('available'));
    const cleanupDownloaded = electron.onUpdateDownloaded(() => setUpdateState('downloaded'));

    return () => {
      cleanupAvailable();
      cleanupDownloaded();
    };
  }, [isElectron, electron]);

  if (!isElectron || updateState === 'none') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm">
      <Download className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        {updateState === 'available' ? (
          <p className="text-sm">Aggiornamento in download...</p>
        ) : (
          <>
            <p className="text-sm font-medium">Aggiornamento pronto</p>
            <p className="text-xs opacity-80">Riavvia per installare la nuova versione</p>
          </>
        )}
      </div>
      {updateState === 'downloaded' && (
        <button
          onClick={() => electron?.installUpdate()}
          className="bg-white text-blue-600 text-xs font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          Riavvia
        </button>
      )}
      <button
        onClick={() => setUpdateState('none')}
        className="opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
