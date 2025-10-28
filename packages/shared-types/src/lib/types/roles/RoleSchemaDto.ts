/** Minimal permission rule for role-based access control. */
interface PermissionDto {
  action: string | string[];
  subject: string | string[];
  fields?: unknown;
  conditionals?: unknown;
  inverted?: boolean;
  reason?: string;
}

/** Role definition including id, display name, and allowed permissions. */
interface RoleSchemaDto {
  id: string;
  name: string;
  permissions: PermissionDto[];
}

export type { RoleSchemaDto, PermissionDto };
