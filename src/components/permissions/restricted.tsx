'use client';

import { useUserRole } from '@/components/shared/UserRoleContext';
import type { UserRole } from '@/lib/permissions/types';

export function Restricted({
  roles,
  children,
  fallback = null,
}: {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const role = useUserRole();
  if (!roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
