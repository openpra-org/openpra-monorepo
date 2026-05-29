import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PosRolesService, type PosRolesResponse } from "./pos-roles.service";
import type { PosWorkbookRoleName } from "./pos-workbook-role.schema";

interface AssignBody {
  username?: string;
  teamId?: string;
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
    const hasUsername = typeof body.username === "string" && body.username.length > 0;
    const hasTeam = typeof body.teamId === "string" && body.teamId.length > 0;
    if (hasUsername === hasTeam) throw new BadRequestException("Specify exactly one of username or teamId");
    if (typeof body.role !== "string") throw new BadRequestException("role required");
    if (hasUsername) {
      return this.posRolesService.assignUser(id, body.username!, body.role, { username: req.user!.username });
    }
    return this.posRolesService.assignTeam(id, body.teamId!, body.role, { username: req.user!.username });
  }

  @Delete("user/:username/:role")
  @HttpCode(HttpStatus.OK)
  unassignUser(
    @Param("id") id: string,
    @Param("username") username: string,
    @Param("role") role: PosWorkbookRoleName,
    @Req() req: AuthenticatedRequest,
  ): Promise<PosRolesResponse> {
    return this.posRolesService.unassignUser(id, username, role, { username: req.user!.username });
  }

  @Delete("team/:teamId/:role")
  @HttpCode(HttpStatus.OK)
  unassignTeam(
    @Param("id") id: string,
    @Param("teamId") teamId: string,
    @Param("role") role: PosWorkbookRoleName,
    @Req() req: AuthenticatedRequest,
  ): Promise<PosRolesResponse> {
    return this.posRolesService.unassignTeam(id, teamId, role, { username: req.user!.username });
  }
}
