/** Identifier for the built-in Admin role. */
export const AdminRole = 'admin-role';
/** Identifier for the built-in Member role. */
export const MemberRole = 'member-role';
/** Identifier for the built-in Collaborator role. */
export const CollabRole = 'collab-role';

interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

interface Permission {
  action: string | string[];
  subject: string | string[];
  fields?: any;
  conditionals?: any;
  inverted?: boolean;
  reason?: string;
}

/**
 * Built-in role catalog exposed by the SDK.
 * Consumers may use these to seed role UIs or enforce access checks client-side.
 * @public
 */
export const PredefinedRoles: Role[] = [
  {
    id: AdminRole,
    name: 'Admin',
    permissions: [
      {
        action: 'manage',
        subject: 'all',
      },
    ],
  },
  {
    id: MemberRole,
    name: 'Member',
    permissions: [
      {
        action: 'read',
        subject: 'users',
      },
      {
        action: 'read',
        subject: 'roles',
      },
      {
        action: 'read',
        subject: 'invitation',
      },
    ],
  },
  {
    id: CollabRole,
    name: 'Collaborator',
    permissions: [
      {
        action: 'read',
        subject: 'all',
      },
    ],
  },
];
