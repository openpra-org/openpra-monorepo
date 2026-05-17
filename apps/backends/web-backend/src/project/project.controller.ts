import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import {
  type CreateProjectRequest,
  type Project,
  type RecentProjectResponse,
  type SharedProjectsResponse,
  CreateProjectRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ProjectService } from "./project.service";

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get("recent")
  @HttpCode(HttpStatus.OK)
  getRecent(@Req() req: AuthenticatedRequest): Promise<RecentProjectResponse> {
    return this.projectService.getRecentProject({ username: req.user!.username });
  }

  @Get("shared")
  @HttpCode(HttpStatus.OK)
  getShared(@Req() req: AuthenticatedRequest): Promise<SharedProjectsResponse> {
    return this.projectService.getSharedProjects({ username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(CreateProjectRequestSchema)) body: CreateProjectRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectService.createProject(body, { username: req.user!.username });
  }
}
