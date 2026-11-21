'use client';

import { useUserRole } from '@/components/shared/UserRoleContext';
import { can, hasRole } from '@/lib/permissions/check';
import { useQuoteReadOnly } from '@/components/quote-editor/quote-readonly';

export function usePermissions() {
  const role = useUserRole();
  // Dentro un preventivo bloccato (B1) si modifica nulla, come un "viewer".
  const locked = useQuoteReadOnly();
  return {
    role,
    can: {
      createQuote: can.createQuote(role),
      editQuote: can.editQuote(role) && !locked,
      deleteQuote: can.deleteQuote(role),
      changeQuoteStatus: can.changeQuoteStatus(role),
      exportQuote: can.exportQuote(role),
      exportQuoteAdvanced: can.exportQuoteAdvanced(role),
      importQuote: can.importQuote(role),
      manageClients: can.manageClients(role),
      viewStats: can.viewStats(role),
      manageCommunications: can.manageCommunications(role),
      manageQuoteImages: can.manageQuoteImages(role) && !locked,
      manageSites: can.manageSites(role),
      manageUsers: can.manageUsers(role),
      manageCompanySettings: can.manageCompanySettings(role),
      viewAuditLog: can.viewAuditLog(role),
    },
    isAdmin: hasRole(role, 'admin'),
    isEditor: hasRole(role, 'editor'),
    isViewer: hasRole(role, 'viewer') || locked,
  };
}
