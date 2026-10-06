export type UserRole = 'admin' | 'editor' | 'viewer';

export const ROLES: Record<UserRole, { label: string; description: string }> = {
  admin: {
    label: 'Amministratore',
    description: 'Gestisce utenti, impostazioni e ha accesso completo a tutti i preventivi',
  },
  editor: {
    label: 'Editor',
    description: 'Crea e modifica preventivi, clienti e comunicazioni',
  },
  viewer: {
    label: 'Visualizzatore',
    description: 'Visualizza preventivi e li scarica in PDF, senza poterli modificare',
  },
};
