import { Controller, UseGuards } from "@nestjs/common";
import { RoleSchemaDto } from "shared-types/src/openpra-zod-mef/role/role-schema";
import { TypedBody, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesService } from "./roles.service";
import { Roles } from "./schemas/roles.schema";

@Controller()
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @TypedRoute.Get("/roles/")
  async getAllRoles(@TypedQuery() query: { id?: string[] }): Promise<Roles[]> {
    return this.rolesService.getAllRoles(query.id);
  }

  @TypedRoute.Get("/role/:roleId")
  async getRoleById(@TypedParam("roleId") roleId: string): Promise<Roles> {
    return this.rolesService.getRole(roleId);
  }

  @TypedRoute.Post("/role/")
  createRole(@TypedBody() body: RoleSchemaDto): Promise<void> {
    return this.rolesService.createRole(body);
  }

  @TypedRoute.Put("/role/")
  async updateRole(@TypedBody() body: RoleSchemaDto): Promise<void> {
    return this.rolesService.updateRole(body);
  }

  @TypedRoute.Delete("/role/:roleId")
  async removeRole(@TypedParam("roleId") roleId: string): Promise<void> {
    return this.rolesService.deleteRole(roleId);
  }
}
