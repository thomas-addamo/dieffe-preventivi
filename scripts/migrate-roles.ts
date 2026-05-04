/**
 * One-time script: converte role='user' → role='editor' nel database.
 * Eseguire una sola volta dopo il deploy: pnpm tsx scripts/migrate-roles.ts
 */
import { db } from '../src/lib/db/client';
import { users } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function migrateRoles() {
  console.log('Migrazione ruoli: user → editor...');
  const result = await db
    .update(users)
    .set({ role: 'editor' })
    .where(eq(users.role, 'user' as never));
  console.log(`Completato. Righe aggiornate.`);
  console.log(result);
  process.exit(0);
}

migrateRoles().catch((e) => {
  console.error(e);
  process.exit(1);
});
