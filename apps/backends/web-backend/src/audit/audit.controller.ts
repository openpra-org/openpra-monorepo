import { Controller, Get, HttpCode, HttpStatus, Param, Req, UseGuards } from "@nestjs/common";
import type { AuditLogResponse } from "interfaces-shared-types";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AuditService } from "./audit.service";

@Controller("audit")
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("teams/:id")
  @HttpCode(HttpStatus.OK)
  teamLog(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<AuditLogResponse> {
    return this.auditService.getTeamLog(id, req.user!.username);
  }

  @Get("projects/:id")
  @HttpCode(HttpStatus.OK)
  projectLog(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<AuditLogResponse> {
    return this.auditService.getProjectLog(id, req.user!.username);
  }
}
