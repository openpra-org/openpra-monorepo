import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  type AvailableTeamsResponse,
  type BulkInviteResponse,
  type BulkInviteToTeamRequest,
  type CreateTeamRequest,
  type InviteToTeamRequest,
  type MyInvitationsResponse,
  type MyTeamsResponse,
  type Team,
  type TeamDetail,
  type TransferTeamAdminRequest,
  type UpdateTeamRequest,
  BulkInviteToTeamRequestSchema,
  CreateTeamRequestSchema,
  InviteToTeamRequestSchema,
  TransferTeamAdminRequestSchema,
  UpdateTeamRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { TeamsService } from "./teams.service";

const TEAM_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

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

  @Post(":id/invites/bulk")
  @HttpCode(HttpStatus.OK)
  bulkInvite(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(BulkInviteToTeamRequestSchema)) body: BulkInviteToTeamRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<BulkInviteResponse> {
    return this.teamsService.bulkInvite(id, body.identifiers, req.user!.username);
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

  @Post(":id/transfer-admin")
  @HttpCode(HttpStatus.OK)
  transferAdmin(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(TransferTeamAdminRequestSchema)) body: TransferTeamAdminRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    return this.teamsService.transferAdmin(id, body.username, req.user!.username);
  }

  @Post(":id/leads/:username")
  @HttpCode(HttpStatus.OK)
  promoteLead(
    @Param("id") id: string,
    @Param("username") username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    return this.teamsService.promoteToLead(id, username, req.user!.username);
  }

  @Delete(":id/leads/:username")
  @HttpCode(HttpStatus.OK)
  demoteLead(
    @Param("id") id: string,
    @Param("username") username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    return this.teamsService.demoteFromLead(id, username, req.user!.username);
  }

  @Post(":id/avatar")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", {
    storage: memoryStorage(),
    limits: { fileSize: TEAM_AVATAR_MAX_BYTES },
  }))
  uploadAvatar(
    @Param("id") id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    if (file === undefined) throw new BadRequestException("Expected a 'file' field in multipart body");
    return this.teamsService.setAvatar(id, file, req.user!.username);
  }

  @Delete(":id/avatar")
  @HttpCode(HttpStatus.OK)
  deleteAvatar(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<Team> {
    return this.teamsService.clearAvatar(id, req.user!.username);
  }
}
