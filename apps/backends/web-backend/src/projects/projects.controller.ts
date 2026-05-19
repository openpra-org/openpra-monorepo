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
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type CreateProjectRequest,
  type OwnedProjectsResponse,
  type Project,
  type RecentProjectResponse,
  type SharedProjectsResponse,
  type TransferProjectToTeamRequest,
  type UpdateProjectRequest,
  CreateProjectRequestSchema,
  TransferProjectToTeamRequestSchema,
  UpdateProjectRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getOwned(@Req() req: AuthenticatedRequest): Promise<OwnedProjectsResponse> {
    return this.projectsService.getOwnedProjects({ username: req.user!.username });
  }

  @Get("recent")
  @HttpCode(HttpStatus.OK)
  getRecent(@Req() req: AuthenticatedRequest): Promise<RecentProjectResponse> {
    return this.projectsService.getRecentProject({ username: req.user!.username });
  }

  @Get("shared")
  @HttpCode(HttpStatus.OK)
  getShared(@Req() req: AuthenticatedRequest): Promise<SharedProjectsResponse> {
    return this.projectsService.getSharedProjects({ username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(CreateProjectRequestSchema)) body: CreateProjectRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.createProject(body, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateProjectRequestSchema)) body: UpdateProjectRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.updateProject(id, body, { username: req.user!.username });
  }

  @Post(":id/duplicate")
  @HttpCode(HttpStatus.CREATED)
  duplicate(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<Project> {
    return this.projectsService.duplicateProject(id, { username: req.user!.username });
  }

  @Post(":id/transfer-to-team")
  @HttpCode(HttpStatus.OK)
  transferToTeam(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(TransferProjectToTeamRequestSchema)) body: TransferProjectToTeamRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.transferToTeam(id, body.teamId, { username: req.user!.username });
  }

  @Post(":id/transfer-to-self")
  @HttpCode(HttpStatus.OK)
  transferToSelf(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<Project> {
    return this.projectsService.transferToSelf(id, { username: req.user!.username });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.projectsService.deleteProject(id, { username: req.user!.username });
  }
}
