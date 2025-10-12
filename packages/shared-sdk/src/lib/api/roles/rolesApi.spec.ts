import { GetAllRoles, GetRoleById, CreateRole, UpdateRole, DeleteRole } from "./rolesApi";
import * as ApiModule from "../ApiManager";
import { RoleSchemaDto } from "shared-types/src/lib/types/roles/RoleSchemaDto";

describe("rolesApi", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it("GetAllRoles builds query and returns list", async () => {
    const sample: RoleSchemaDto[] = [
      { id: "admin-role", name: "Admin", permissions: [] },
      { id: "member-role", name: "Member", permissions: [] },
    ];
    jest.spyOn(ApiModule.ApiManager, "getWithOptions").mockResolvedValue({
      ok: true,
      json: async () => sample,
    } as any);

    const roles = await GetAllRoles(["admin-role", "member-role"]);
    expect(roles).toHaveLength(2);
  });

  it("GetRoleById returns a role", async () => {
    const role: RoleSchemaDto = { id: "collab-role", name: "Collaborator", permissions: [] };
    jest.spyOn(ApiModule.ApiManager, "getWithOptions").mockResolvedValue({ ok: true, json: async () => role } as any);

    const res = await GetRoleById("collab-role");
    expect(res?.id).toBe("collab-role");
  });

  it("CreateRole posts payload", async () => {
    const postSpy = jest.spyOn(ApiModule.ApiManager, "post").mockResolvedValue({ ok: true } as any);
    await expect(CreateRole({ id: "x", name: "X", permissions: [] })).resolves.toBeUndefined();
    expect(postSpy).toHaveBeenCalled();
  });

  it("UpdateRole puts payload", async () => {
    const putSpy = jest.spyOn(ApiModule.ApiManager, "put").mockResolvedValue({ ok: true } as any);
    await expect(UpdateRole({ id: "x", name: "X", permissions: [] })).resolves.toBeUndefined();
    expect(putSpy).toHaveBeenCalled();
  });

  it("DeleteRole issues delete", async () => {
    const delSpy = jest.spyOn(ApiModule.ApiManager, "delete").mockResolvedValue({ ok: true } as any);
    await expect(DeleteRole("x")).resolves.toBeUndefined();
    expect(delSpy).toHaveBeenCalled();
  });
});
