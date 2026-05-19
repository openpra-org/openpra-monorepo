import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type AvailableTeamsResponse,
  type CreateTeamRequest,
  type InviteToTeamRequest,
  type MyInvitationsResponse,
  type MyTeamsResponse,
  type Team,
  type TeamDetail,
  type UpdateTeamRequest,
  CreateTeamRequestSchema,
  InviteToTeamRequestSchema,
  UpdateTeamRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { TeamsService } from "./teams.service";

@Controller("teams")
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get("mine")
  @HttpCode(HttpStatus.OK)
  getMine(@Req() req: AuthenticatedRequest): Promise<MyTeamsResponse> {
    return this.teamsService.getMyTeams(req.user!.username);
  }

  @Get("invitations")
  @HttpCode(HttpStatus.OK)
  getInvitations(@Req() req: AuthenticatedRequest): Promise<MyInvitationsResponse> {
    return this.teamsService.getMyInvitations(req.user!.username);
  }

  @Get("available")
  @HttpCode(HttpStatus.OK)
  getAvailable(
    @Req() req: AuthenticatedRequest,
    @Query("q") q?: string,
  ): Promise<AvailableTeamsResponse> {
    return this.teamsService.getAvailableTeams(req.user!.username, q);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  getDetail(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<TeamDetail> {
    return this.teamsService.getTeamDetail(id, req.user!.username);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(CreateTeamRequestSchema)) body: CreateTeamRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    return this.teamsService.createTeam(body, req.user!.username);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateTeamRequestSchema)) body: UpdateTeamRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    return this.teamsService.updateTeam(id, body, req.user!.username);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.teamsService.deleteTeam(id, req.user!.username);
  }

  @Post(":id/join")
  @HttpCode(HttpStatus.OK)
  join(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<Team> {
    return this.teamsService.joinTeam(id, req.user!.username);
  }

  @Delete(":id/membership")
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.teamsService.leaveTeam(id, req.user!.username);
  }

  @Post(":id/invites")
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(InviteToTeamRequestSchema)) body: InviteToTeamRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    return this.teamsService.inviteUser(id, body.identifier, req.user!.username);
  }

  @Post(":id/invites/me/accept")
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<Team> {
    return this.teamsService.acceptInvite(id, req.user!.username);
  }

  @Delete(":id/invites/me")
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineInvite(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.teamsService.declineInvite(id, req.user!.username);
  }

  @Delete(":id/invites/:username")
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvite(
    @Param("id") id: string,
    @Param("username") username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.teamsService.cancelInvite(id, username, req.user!.username);
  }

  @Delete(":id/members/:username")
  @HttpCode(HttpStatus.NO_CONTENT)
  async kick(
    @Param("id") id: string,
    @Param("username") username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.teamsService.kickMember(id, username, req.user!.username);
  }
}
