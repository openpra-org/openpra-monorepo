import { AuthService } from "../AuthService";
import { ApiManager } from "../ApiManager";
import { RoleSchemaDto } from "../../../openpra-zod-mef/role/role-schema";

const ApiEndpoint = "/api";

const GetRole = (): string[] => {
  try {
    return AuthService.getRole();
  } catch (e) {
    throw new Error("The user is not logged in or token expired");
  }
};

const GetAllRoles = async (ids: string[]): Promise<RoleSchemaDto[]> => {
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
};

const GetRoleById = async (roleId: string): Promise<RoleSchemaDto | null> => {
  const response = await ApiManager.getWithOptions(`${ApiEndpoint}/roles/${roleId}`);
  if (response.ok) {
    return (await response.json()) as RoleSchemaDto;
  }
  throw new Error(`Error fetching data for role id: ${roleId}`);
};

const CreateRole = async (role: RoleSchemaDto): Promise<void> => {
  const response = await ApiManager.post(`${ApiEndpoint}/roles/`, JSON.stringify(role));
  if (response.ok) {
    return;
  }
  throw new Error(`Error creating new role`);
};

const UpdateRole = async (role: RoleSchemaDto): Promise<void> => {
  const response = await ApiManager.put(`${ApiEndpoint}/roles/`, JSON.stringify(role));
  if (response.ok) {
    return;
  }
  throw new Error(`Error updating role`);
};

const DeleteRole = async (roleId: string): Promise<void> => {
  const response = await ApiManager.delete(`${ApiEndpoint}/roles/${roleId}`);
  if (response.ok) {
    return;
  }
  throw new Error(`Error deleting role`);
};

export { GetRole, GetAllRoles, GetRoleById, CreateRole, UpdateRole, DeleteRole };
