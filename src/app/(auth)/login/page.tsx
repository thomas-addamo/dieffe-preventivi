import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { Building2 } from "lucide-react";

export default async function LoginPage() {
  const session = await getCurrentUser();
  if (session) redirect("/dashboard");

  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(users);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dieffe Preventivi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestione preventivi edili
          </p>
        </div>

        <div className="bg-card border rounded-lg p-6 shadow-sm">
          <LoginForm isFirstRun={userCount === 0} />
        </div>
      </div>
    </div>
  );
}
