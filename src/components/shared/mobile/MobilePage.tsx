import { Page, PageHeader } from "@/components/shared/Page";

interface MobilePageProps {
  title: string;
  subtitle?: string;
  /** Azione a destra del titolo (es. bottone) */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pagina in stile iOS "large title" (Profilo, Altro): stessa impaginazione e
 * stesso titolo delle altre pagine (Page/PageHeader), in colonna stretta.
 */
export function MobilePage({ title, subtitle, action, children, className }: MobilePageProps) {
  return (
    <Page width="narrow" className={className}>
      <PageHeader title={title} subtitle={subtitle} actions={action} />
      {children}
    </Page>
  );
}
