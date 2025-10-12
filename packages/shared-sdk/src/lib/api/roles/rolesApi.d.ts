import { RoleSchemaDto } from "shared-types/src/lib/types/roles/RoleSchemaDto";
declare const GetRole: () => string[];
declare const GetAllRoles: (ids: string[]) => Promise<RoleSchemaDto[]>;
declare const GetRoleById: (roleId: string) => Promise<RoleSchemaDto | null>;
declare const CreateRole: (role: RoleSchemaDto) => Promise<void>;
declare const UpdateRole: (role: RoleSchemaDto) => Promise<void>;
declare const DeleteRole: (roleId: string) => Promise<void>;
export { GetRole, GetAllRoles, GetRoleById, CreateRole, UpdateRole, DeleteRole };
