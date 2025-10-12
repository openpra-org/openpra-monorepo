interface PermissionDto {
  action: string | string[];
  subject: string | string[];
  fields?: unknown;
  conditionals?: unknown;
  inverted?: boolean;
  reason?: string;
}

interface RoleSchemaDto {
  id: string;
  name: string;
  permissions: PermissionDto[];
}

export type { RoleSchemaDto, PermissionDto };
