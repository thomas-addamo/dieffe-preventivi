import Link from "next/link";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Page, PageHeader } from "@/components/shared/Page";
import { SITES_MAINTENANCE_MESSAGE } from "@/lib/features";

/** Pagina mostrata al posto della Gestione Cantieri mentre è sospesa. */
export function SitesMaintenance() {
  return (
    <Page>
      <PageHeader title="Gestione Cantieri" />
      <EmptyState
        icon={Wrench}
        title="In manutenzione"
        description={SITES_MAINTENANCE_MESSAGE}
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Torna alla dashboard</Link>
          </Button>
        }
      />
    </Page>
  );
}
