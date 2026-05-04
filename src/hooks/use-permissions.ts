'use client';

import { useUserRole } from '@/components/shared/UserRoleContext';
import { can, hasRole } from '@/lib/permissions/check';

export function usePermissions() {
  const role = useUserRole();
  return {
    role,
    can: {
      createQuote: can.createQuote(role),
      editQuote: can.editQuote(role),
      deleteQuote: can.deleteQuote(role),
      changeQuoteStatus: can.changeQuoteStatus(role),
      exportQuote: can.exportQuote(role),
      exportQuoteAdvanced: can.exportQuoteAdvanced(role),
      importQuote: can.importQuote(role),
      manageClients: can.manageClients(role),
      manageTemplates: can.manageTemplates(role),
      manageQuoteImages: can.manageQuoteImages(role),
      manageUsers: can.manageUsers(role),
      manageCompanySettings: can.manageCompanySettings(role),
      viewAuditLog: can.viewAuditLog(role),
    },
    isAdmin: hasRole(role, 'admin'),
    isEditor: hasRole(role, 'editor'),
    isViewer: hasRole(role, 'viewer'),
  };
}
