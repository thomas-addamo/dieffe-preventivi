// ─────────────────────────────────────────────────────────────────────────────
// Migrazioni automatiche al deploy (eseguito da "pnpm build").
//
// Su Vercel, SOLO per il deploy di produzione (VERCEL_ENV=production), applica
// le migrazioni in src/lib/db/migrations prima di "next build": il database è
// sempre allineato al codice pubblicato, senza passaggi manuali.
// I deploy di anteprima e le build locali non toccano il database (per forzarlo:
// MIGRATE_ON_BUILD=1).
//
// Se il database è stato creato senza il registro delle migrazioni di Drizzle
// (es. con "drizzle-kit push"), viene allineato una volta sola ("baseline")
// all'ultima migrazione già presente, così non si rieseguono le vecchie.
// Una migrazione che fallisce fa fallire la build: Vercel continua a servire
// la versione precedente, mai un'app con il database disallineato.
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const MIGRATIONS = join(process.cwd(), "src/lib/db/migrations");

/** Colonna introdotta da ogni migrazione storica: serve a capire fin dove è arrivato un DB senza registro. */
const MARKERS: { tag: string; table: string; column: string }[] = [
  { tag: "0011_fair_pixie", table: "company_settings", column: "ai_enabled" },
];

async function main() {
  const enabled = process.env.VERCEL_ENV === "production" || process.env.MIGRATE_ON_BUILD === "1";
  if (!enabled) {
    console.log("↷ Migrazioni saltate (non è un deploy di produzione)");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL mancante: impossibile applicare le migrazioni");

  const sql = neon(url);

  // ── Baseline per database senza registro ──
  const [{ has_registry }] = (await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    ) as has_registry`) as { has_registry: boolean }[];
  const [{ has_users }] = (await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'users'
    ) as has_users`) as { has_users: boolean }[];

  if (!has_registry && has_users) {
    const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta/_journal.json"), "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    let baseline: { tag: string; when: number } | null = null;
    for (const m of MARKERS) {
      const rows = (await sql`
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = ${m.table} and column_name = ${m.column}`) as unknown[];
      if (rows.length) baseline = journal.entries.find((e) => e.tag === m.tag) ?? baseline;
    }
    if (!baseline) {
      throw new Error("Database esistente senza registro migrazioni e versione non riconosciuta: intervento manuale necessario");
    }
    const hash = createHash("sha256")
      .update(readFileSync(join(MIGRATIONS, `${baseline.tag}.sql`), "utf8"))
      .digest("hex");
    await sql`create schema if not exists drizzle`;
    await sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
    await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`;
    console.log(`✓ Registro migrazioni allineato a ${baseline.tag}`);
  }

  await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS });
  console.log("✓ Migrazioni applicate");
}

main().catch((e) => {
  console.error("✗ Migrazioni non riuscite:", e);
  process.exit(1);
});
