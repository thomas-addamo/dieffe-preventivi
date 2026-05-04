'use client';

import { createContext, useContext } from 'react';
import type { UserRole } from '@/lib/permissions/types';

const UserRoleContext = createContext<UserRole>('viewer');

export function UserRoleProvider({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  return <UserRoleContext.Provider value={role}>{children}</UserRoleContext.Provider>;
}

export function useUserRole(): UserRole {
  return useContext(UserRoleContext);
}
