import { Controller, Get, Post, Param, Body, UseFilters, UseGuards, Put, Delete, Query } from "@nestjs/common";
import { RoleSchemaDto } from "shared-types/src/openpra-zod-mef/role/role-schema";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesService } from "./roles.service";
import { Roles } from "./schemas/roles.schema";

@Controller()
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get("/roles/")
  async getAllRoles(@Query() query: { id?: string[] }): Promise<Roles[]> {
    return this.rolesService.getAllRoles(query.id);
  }

  @Get("/role/:roleId")
  async getRoleById(@Param("roleId") roleId: string): Promise<Roles> {
    return this.rolesService.getRole(roleId);
  }

  @Post("/role/")
  createRole(@Body() body: RoleSchemaDto): Promise<void> {
    return this.rolesService.createRole(body);
  }

  @Put("/role/")
  async updateRole(@Body() body: RoleSchemaDto): Promise<void> {
    return this.rolesService.updateRole(body);
  }

  @Delete("/role/:roleId")
  async removeRole(@Param("roleId") roleId: string): Promise<void> {
    return this.rolesService.deleteRole(roleId);
  }
}
