import { Controller, Get, Post, Param, Body, UseFilters, UseGuards, Put, Delete, Query } from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { RolesService } from "./roles.service";
import { Roles } from "./schemas/roles.schema";
import { Role } from "./schemas/predefined-roles";

/**
 * Controller for role and permission management.
 * Secured with JWT; exposes CRUD endpoints for roles.
 * @public
 */
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(InvalidTokenFilter)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async getAllRoles(@Query() query: { id?: string[] }): Promise<Roles[]> {
    return this.rolesService.getAllRoles(query.id);
  }

  @Get("/:roleId")
  async getRoleById(@Param("roleId") roleId: string): Promise<Roles> {
    return this.rolesService.getRole(roleId);
  }

  @Post()
  createRole(@Body() body: Role): Promise<void> {
    return this.rolesService.createRole(body);
  }

  @Put()
  async updateRole(@Body() body: Role): Promise<void> {
    return this.rolesService.updateRole(body);
  }

  @Delete("/:roleId")
  async removeRole(@Param("roleId") roleId: string): Promise<void> {
    return this.rolesService.deleteRole(roleId);
  }
}
