import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar userRole={user.role} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header userName={user.name} userEmail={user.email} />
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
