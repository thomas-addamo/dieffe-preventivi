import { QuoteTabsBar } from "@/components/quote-editor/QuoteTabsBar";

// Layout PERSISTENTE per l'editor: resta montato passando da un preventivo
// all'altro (stesso segmento dinamico [id]), così la barra dei tab non si
// rimonta e l'esperienza è fluida come in un editor a schede.
export default function QuoteEditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <QuoteTabsBar />
      {children}
    </>
  );
}
