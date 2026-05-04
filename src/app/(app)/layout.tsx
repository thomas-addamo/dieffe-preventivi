import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/shared/AppShell";
import { QueryProvider } from "@/components/shared/QueryProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const { user } = session;

  return (
    <QueryProvider>
      <AppShell
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
      >
        {children}
      </AppShell>
    </QueryProvider>
  );
}
