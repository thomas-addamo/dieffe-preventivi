import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ListinoClient } from "./ListinoClient";

export default async function ListinoPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.user.role === "viewer") redirect("/dashboard");

  return <ListinoClient userRole={session.user.role} />;
}
