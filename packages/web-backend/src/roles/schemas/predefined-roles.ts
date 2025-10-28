/** Identifier for the Administrator role. */
export const AdminRole = "admin-role";
/** Identifier for the Member role. */
export const MemberRole = "member-role";
/** Identifier for the Collaborator role. */
export const CollabRole = "collab-role";

/**
 * A role definition with an ID, display name, and permissions.
 */
export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

/**
 * A permission rule (action on subject), optionally field-scoped or conditional.
 */
export interface Permission {
  action: string | string[];
  subject: string | string[];
  fields?: any;
  conditionals?: any;
  inverted?: boolean;
  reason?: string;
}

/**
 * A set of roles shipped by default: Admin, Member, and Collaborator.
 */
export const PredefinedRoles: Role[] = [
  {
    id: AdminRole,
    name: "Admin",
    permissions: [
      {
        action: "manage",
        subject: "all",
      },
    ],
  },
  {
    id: MemberRole,
    name: "Member",
    permissions: [
      {
        action: "read",
        subject: "users",
      },
      {
        action: "read",
        subject: "roles",
      },
      {
        action: "read",
        subject: "invitation",
      },
    ],
  },
  {
    id: CollabRole,
    name: "Collaborator",
    permissions: [
      {
        action: "read",
        subject: "all",
      },
    ],
  },
];
