'use client';

export function useElectron() {
  const isElectron = typeof window !== 'undefined' && !!window.electron;

  return {
    isElectron,
    electron: typeof window !== 'undefined' ? window.electron : undefined,
  };
}
