export const AdminRole = "admin-role";
export const MemberRole = "member-role";
export const CollabRole = "collab-role";

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  action: string | string[];
  subject: string | string[];
  fields?: any;
  conditionals?: any;
  inverted?: boolean;
  reason?: string;
}

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
