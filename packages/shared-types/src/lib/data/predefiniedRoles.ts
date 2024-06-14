import { RoleSchemaDto } from "packages/shared-types/src/openpra-zod-mef/role/role-schema";

const AdminRole = "admin-role";
const MemberRole = "member-role";
const CollabRole = "collab-role";

const PredefinedRoles: RoleSchemaDto[] = [
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
