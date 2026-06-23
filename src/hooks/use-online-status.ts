'use client';
import { useState, useEffect } from 'react';
import { useElectron } from './use-electron';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const { isElectron, electron } = useElectron();

  useEffect(() => {
    if (isElectron && electron) {
      // In Electron: usa evento nativo più affidabile
      const cleanup = electron.onOnlineStatus(setIsOnline);
      return cleanup;
    } else {
      // In browser: usa eventi standard
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [isElectron, electron]);

  return isOnline;
}
