import { PageLoader } from "@/components/shared/PageLoader";

// Spinner mostrato passando da un preventivo all'altro: il layout persistente
// (barra dei tab) resta visibile, l'area editor mostra il caricamento.
export default function Loading() {
  return <PageLoader />;
}
