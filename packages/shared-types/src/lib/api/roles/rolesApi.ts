import { AuthService } from "../AuthService";
import { ApiManager } from "../ApiManager";
import { RoleSchemaDto } from "../../../openpra-zod-mef/role/role-schema";

const ApiEndpoint = "/api";
const RoleEndpoint = `${ApiEndpoint}/roles`;

const GetRole = (): string[] => {
  try {
    return AuthService.getRole();
  } catch (e) {
    throw new Error("The user is not logged in or token expired");
  }
};

const GetAllRoles = async (ids: string[]): Promise<RoleSchemaDto[]> => {
  let url = `${RoleEndpoint}/roles/`;
  if (ids.length > 0) {
    let queryParams = "?";
    for (const id of ids) {
      queryParams += `id=${id}&`;
    }
    url += queryParams;
  }
  const response = await ApiManager.getWithOptions(url);
  if (response.ok) {
    return (await response.json()) as RoleSchemaDto[];
  }
  throw new Error(`Error fetching all roles`);
};

const GetRoleById = async (roleId: string): Promise<RoleSchemaDto | null> => {
  const response = await ApiManager.getWithOptions(`${RoleEndpoint}/role/${roleId}`);
  if (response.ok) {
    return (await response.json()) as RoleSchemaDto;
  }
  throw new Error(`Error fetching data for role id: ${roleId}`);
};

const CreateRole = async (role: RoleSchemaDto): Promise<void> => {
  const response = await ApiManager.post(`${RoleEndpoint}/role/`, JSON.stringify(role));
  if (response.ok) {
    return;
  }
  throw new Error(`Error creating new role`);
};

const UpdateRole = async (role: RoleSchemaDto): Promise<void> => {
  const response = await ApiManager.put(`${RoleEndpoint}/role/`, JSON.stringify(role));
  if (response.ok) {
    return;
  }
  throw new Error(`Error updating role`);
};

const DeleteRole = async (roleId: string): Promise<void> => {
  const response = await ApiManager.delete(`${RoleEndpoint}/role/${roleId}`);
  if (response.ok) {
    return;
  }
  throw new Error(`Error deleting role`);
};

export { GetRole, GetAllRoles, GetRoleById, CreateRole, UpdateRole, DeleteRole };
