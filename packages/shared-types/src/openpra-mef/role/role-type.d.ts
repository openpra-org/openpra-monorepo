import typia from "typia";

export interface Permission {
  action: string | string[];
  subject: string | string[];
  fields?: unknown;
  conditionals?: unknown;
  inverted?: boolean;
  reason?: string;
}
export const PermissionSchema = typia.json.application<[Permission], "3.0">();

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}
export const RoleSchema = typia.json.application<[Role], "3.0">();
