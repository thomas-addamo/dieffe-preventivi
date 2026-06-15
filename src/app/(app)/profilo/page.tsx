import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfiloClient } from "./ProfiloClient";

export default async function ProfiloPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  return (
    <ProfiloClient
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
    />
  );
}
