import { AuthService } from "../AuthService";
import { ApiManager } from "../ApiManager";
import { RoleSchemaDto } from "shared-types/src/lib/types/roles/RoleSchemaDto";

const ApiEndpoint = "/api";

/**
 * Get the current user's roles from the auth token.
 * @returns An array of role identifiers.
 */
export function GetRole(): string[] {
  try {
    return AuthService.getRole();
  } catch {
    throw new Error("The user is not logged in or token expired");
  }
}

/**
 * Fetch all roles (optionally filtered by a set of ids).
 * @param ids - Optional list of role ids to filter.
 * @returns Role definitions for the given ids, or all roles when ids is empty.
 */
export async function GetAllRoles(ids: string[]): Promise<RoleSchemaDto[]> {
  let url = `${ApiEndpoint}/roles/`;
  if (ids.length > 0) {
    const queryParams = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&");
    url += `?${queryParams}`;
  }
  const response = await ApiManager.getWithOptions(url);
  if (response.ok) {
    return (await response.json()) as RoleSchemaDto[];
  }
  throw new Error(`Error fetching all roles`);
}

/**
 * Fetch a role by its id.
 * @param roleId - Role identifier.
 * @returns Role definition or throws when not found.
 */
export async function GetRoleById(roleId: string): Promise<RoleSchemaDto | null> {
  const response = await ApiManager.getWithOptions(`${ApiEndpoint}/roles/${roleId}`);
  if (response.ok) {
    return (await response.json()) as RoleSchemaDto;
  }
  throw new Error(`Error fetching data for role id: ${roleId}`);
}

/**
 * Create a new role.
 * @param role - Role definition to create.
 */
export async function CreateRole(role: RoleSchemaDto): Promise<void> {
  const response = await ApiManager.post(`${ApiEndpoint}/roles/`, JSON.stringify(role));
  if (response.ok) {
    return;
  }
  throw new Error(`Error creating new role`);
}

/**
 * Update an existing role.
 * @param role - Updated role definition.
 */
export async function UpdateRole(role: RoleSchemaDto): Promise<void> {
  const response = await ApiManager.put(`${ApiEndpoint}/roles/`, JSON.stringify(role));
  if (response.ok) {
    return;
  }
  throw new Error(`Error updating role`);
}

/**
 * Delete a role.
 * @param roleId - Identifier of the role to delete.
 */
export async function DeleteRole(roleId: string): Promise<void> {
  const response = await ApiManager.delete(`${ApiEndpoint}/roles/${roleId}`);
  if (response.ok) {
    return;
  }
  throw new Error(`Error deleting role`);
}
