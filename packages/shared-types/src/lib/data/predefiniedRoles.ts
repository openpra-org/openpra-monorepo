const AdminRole = "admin-role";
const MemberRole = "member-role";
const CollabRole = "collab-role";

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

const PredefinedRoles: Role[] = [
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

export { PredefinedRoles, AdminRole, CollabRole, MemberRole };
