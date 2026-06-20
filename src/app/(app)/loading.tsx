import { PageLoader } from "@/components/shared/PageLoader";

// Fallback istantaneo durante il caricamento delle pagine dell'app.
// Next lo avvolge automaticamente in <Suspense> attorno alle pagine del gruppo (app),
// dentro la shell: top bar / tab bar / sidebar restano, cambia solo il contenuto.
export default function Loading() {
  return <PageLoader />;
}
