/**
 * Loader mostrato nell'area contenuto durante i cambi di pagina (route transition).
 * La chrome (top bar / tab bar / sidebar) resta visibile: si carica solo il contenuto,
 * per un feel da app nativa. Usato da app/(app)/loading.tsx.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center py-20">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  );
}
