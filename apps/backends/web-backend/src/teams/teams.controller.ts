import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type AvailableTeamsResponse,
  type CreateTeamRequest,
  type MyTeamsResponse,
  type Team,
  CreateTeamRequestSchema,
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

  @Get("available")
  @HttpCode(HttpStatus.OK)
  getAvailable(
    @Req() req: AuthenticatedRequest,
    @Query("q") q?: string,
  ): Promise<AvailableTeamsResponse> {
    return this.teamsService.getAvailableTeams(req.user!.username, q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(CreateTeamRequestSchema)) body: CreateTeamRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Team> {
    return this.teamsService.createTeam(body, req.user!.username);
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
}
