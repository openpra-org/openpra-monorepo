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
  type CreateWorkbookRequest,
  type UpdateWorkbookRequest,
  type Workbook,
  type WorkbookListResponse,
  CreateWorkbookRequestSchema,
  UpdateWorkbookRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { WorkbooksService } from "./workbooks.service";

@Controller("projects/:projectId/workbooks")
@UseGuards(JwtAuthGuard)
export class WorkbooksController {
  constructor(private readonly workbooksService: WorkbooksService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @Param("projectId") projectId: string,
    @Query("elementCode") elementCode: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkbookListResponse> {
    return this.workbooksService.listWorkbooks(projectId, elementCode, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreateWorkbookRequestSchema)) body: CreateWorkbookRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Workbook> {
    return this.workbooksService.createWorkbook(projectId, body, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateWorkbookRequestSchema)) body: UpdateWorkbookRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Workbook> {
    return this.workbooksService.updateWorkbook(projectId, id, body, { username: req.user!.username });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.workbooksService.deleteWorkbook(projectId, id, { username: req.user!.username });
  }
}
