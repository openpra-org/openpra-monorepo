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
  type ShareProjectWithTeamRequest,
  type ShareProjectWithUserRequest,
  type SharedProjectsResponse,
  type UpdateProjectRequest,
  type UpdateProjectShareRoleRequest,
  CreateProjectRequestSchema,
  ShareProjectWithTeamRequestSchema,
  ShareProjectWithUserRequestSchema,
  UpdateProjectRequestSchema,
  UpdateProjectShareRoleRequestSchema,
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

  @Post(":id/shares/teams")
  @HttpCode(HttpStatus.OK)
  shareWithTeam(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ShareProjectWithTeamRequestSchema)) body: ShareProjectWithTeamRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.shareWithTeam(id, body.teamId, body.role, { username: req.user!.username });
  }

  @Patch(":id/shares/teams/:teamId")
  @HttpCode(HttpStatus.OK)
  updateTeamShare(
    @Param("id") id: string,
    @Param("teamId") teamId: string,
    @Body(new ZodValidationPipe(UpdateProjectShareRoleRequestSchema)) body: UpdateProjectShareRoleRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.updateTeamShareRole(id, teamId, body.role, { username: req.user!.username });
  }

  @Delete(":id/shares/teams/:teamId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unshareFromTeam(
    @Param("id") id: string,
    @Param("teamId") teamId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.projectsService.unshareFromTeam(id, teamId, { username: req.user!.username });
  }

  @Post(":id/shares/users")
  @HttpCode(HttpStatus.OK)
  shareWithUser(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ShareProjectWithUserRequestSchema)) body: ShareProjectWithUserRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.shareWithUser(id, body.identifier, body.role, { username: req.user!.username });
  }

  @Patch(":id/shares/users/:username")
  @HttpCode(HttpStatus.OK)
  updateUserShare(
    @Param("id") id: string,
    @Param("username") username: string,
    @Body(new ZodValidationPipe(UpdateProjectShareRoleRequestSchema)) body: UpdateProjectShareRoleRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.updateUserShareRole(id, username, body.role, { username: req.user!.username });
  }

  @Delete(":id/shares/users/:username")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unshareFromUser(
    @Param("id") id: string,
    @Param("username") username: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.projectsService.unshareFromUser(id, username, { username: req.user!.username });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.projectsService.deleteProject(id, { username: req.user!.username });
  }
}
