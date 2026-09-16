import { redirect } from "next/navigation";

/**
 * Le statistiche non sono più riservate agli amministratori: la pagina vive in
 * /statistiche. Questa rotta resta solo per non rompere i vecchi collegamenti.
 */
export default function LegacyStatistichePage() {
  redirect("/statistiche");
}
