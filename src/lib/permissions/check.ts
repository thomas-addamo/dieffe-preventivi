import type { UserRole } from './types';

export const can = {
  viewQuotes: (_role: UserRole) => true,
  createQuote: (role: UserRole) => role === 'admin' || role === 'editor',
  editQuote: (role: UserRole) => role === 'admin' || role === 'editor',
  deleteQuote: (role: UserRole) => role === 'admin' || role === 'editor',
  changeQuoteStatus: (role: UserRole) => role === 'admin' || role === 'editor',
  exportQuote: (_role: UserRole) => true,
  exportQuoteAdvanced: (role: UserRole) => role === 'admin' || role === 'editor',
  importQuote: (role: UserRole) => role === 'admin' || role === 'editor',

  viewClients: (_role: UserRole) => true,
  manageClients: (role: UserRole) => role === 'admin' || role === 'editor',

  viewTemplates: (_role: UserRole) => true,
  manageTemplates: (role: UserRole) => role === 'admin' || role === 'editor',

  manageQuoteImages: (role: UserRole) => role === 'admin' || role === 'editor',

  manageUsers: (role: UserRole) => role === 'admin',
  manageCompanySettings: (role: UserRole) => role === 'admin',
  viewAuditLog: (role: UserRole) => role === 'admin',
};

export function hasRole(userRole: UserRole, ...allowed: UserRole[]): boolean {
  return allowed.includes(userRole);
}
