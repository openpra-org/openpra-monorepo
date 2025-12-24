import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseFilters,
  UseGuards,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InvalidTokenFilter } from '../filters/invalid-token.filter';
import { RolesService } from './roles.service';
import { Roles } from './schemas/roles.schema';
import { Role } from './schemas/predefined-roles';

/**
 * Controller for role and permission management.
 * Secured with JWT; exposes CRUD endpoints for roles.
 * @public
 */
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(InvalidTokenFilter)
export class RolesController {
  /**
   * @param rolesService - Service for roles persistence and queries
   */
  constructor(private readonly rolesService: RolesService) {}

  /**
   * List roles with optional ID filtering.
   *
   * @param query - Optional query with a list of role IDs to include.
   * @returns Array of roles matching the filter (or all roles when omitted).
   */
  @Get()
  async getAllRoles(@Query() query: { id?: string[] }): Promise<Roles[]> {
    return this.rolesService.getAllRoles(query.id);
  }

  /**
   * Retrieve a single role by identifier.
   *
   * @param roleId - Role identifier.
   * @returns The role document when found.
   */
  @Get('/:roleId')
  async getRoleById(@Param('roleId') roleId: string): Promise<Roles> {
    return this.rolesService.getRole(roleId);
  }

  /**
   * Create a new role.
   *
   * @param body - New role payload including name and permissions.
   * @returns A promise that resolves when the role is created.
   */
  @Post()
  createRole(@Body() body: Role): Promise<void> {
    return this.rolesService.createRole(body);
  }

  /**
   * Update an existing role.
   *
   * @param body - Role payload including id and fields to update.
   * @returns A promise that resolves when the role is updated.
   */
  @Put()
  async updateRole(@Body() body: Role): Promise<void> {
    return this.rolesService.updateRole(body);
  }

  /**
   * Delete a role by identifier.
   *
   * @param roleId - Role identifier.
   * @returns A promise that resolves when the role is removed.
   */
  @Delete('/:roleId')
  async removeRole(@Param('roleId') roleId: string): Promise<void> {
    return this.rolesService.deleteRole(roleId);
  }
}
