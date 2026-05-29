import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PosRolesService, type PosRolesResponse } from "./pos-roles.service";
import type { PosWorkbookRoleName } from "./pos-workbook-role.schema";

interface AssignBody {
  username: string;
  role: PosWorkbookRoleName;
}

@Controller("pos-workbooks/:id/roles")
@UseGuards(JwtAuthGuard)
export class PosRolesController {
  constructor(private readonly posRolesService: PosRolesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<PosRolesResponse> {
    return this.posRolesService.list(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  assign(@Param("id") id: string, @Body() body: AssignBody, @Req() req: AuthenticatedRequest): Promise<PosRolesResponse> {
    if (typeof body.username !== "string" || body.username.length === 0) throw new BadRequestException("username required");
    if (typeof body.role !== "string") throw new BadRequestException("role required");
    return this.posRolesService.assign(id, body.username, body.role, { username: req.user!.username });
  }

  @Delete(":username/:role")
  @HttpCode(HttpStatus.OK)
  unassign(
    @Param("id") id: string,
    @Param("username") username: string,
    @Param("role") role: PosWorkbookRoleName,
    @Req() req: AuthenticatedRequest,
  ): Promise<PosRolesResponse> {
    return this.posRolesService.unassign(id, username, role, { username: req.user!.username });
  }
}
