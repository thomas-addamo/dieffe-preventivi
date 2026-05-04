import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import type { UserRole } from './types';

export async function requireRole(...allowed: UserRole[]) {
  const session = await getCurrentUser();
  if (!session) {
    return { error: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) };
  }
  const role = session.user.role as UserRole;
  if (!allowed.includes(role)) {
    return { error: NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 }) };
  }
  return { session, role };
}
