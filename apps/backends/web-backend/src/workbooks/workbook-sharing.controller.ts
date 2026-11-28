import { Body, Controller, Delete, Get, HttpCode, HttpStatus, type MessageEvent, Param, Patch, Post, Req, Sse, UseGuards } from "@nestjs/common";
import { Observable, from, switchMap } from "rxjs";
import {
  WorkbookShareAccessRequestSchema,
  WorkbookShareRequestSchema,
  type WorkbookShareAccessRequest,
  type WorkbookShareRequest,
  type WorkbookSharesResponse,
} from "interfaces-shared-types/workbooks";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { WorkbookSharingService } from "./workbook-sharing.service";
import { WorkbookLiveService } from "./workbook-live.service";

@Controller("workbooks")
@UseGuards(JwtAuthGuard)
export class WorkbookSharingController {
  constructor(
    private readonly sharing: WorkbookSharingService,
    private readonly live: WorkbookLiveService,
  ) {}

  @Get(":id/collaborators")
  @HttpCode(HttpStatus.OK)
  list(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<WorkbookSharesResponse> {
    return this.sharing.list(id, { username: req.user!.username });
  }

  @Post(":id/collaborators")
  @HttpCode(HttpStatus.OK)
  share(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(WorkbookShareRequestSchema)) body: WorkbookShareRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkbookSharesResponse> {
    return this.sharing.share(id, body.identifier, body.access, { username: req.user!.username });
  }

  @Patch(":id/collaborators/:username")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Param("username") username: string,
    @Body(new ZodValidationPipe(WorkbookShareAccessRequestSchema)) body: WorkbookShareAccessRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkbookSharesResponse> {
    return this.sharing.update(id, username, body.access, { username: req.user!.username });
  }

  @Delete(":id/collaborators/:username")
  @HttpCode(HttpStatus.OK)
  remove(@Param("id") id: string, @Param("username") username: string, @Req() req: AuthenticatedRequest): Promise<WorkbookSharesResponse> {
    return this.sharing.remove(id, username, { username: req.user!.username });
  }

  @Sse(":id/live")
  changes(@Param("id") id: string, @Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    return from(this.sharing.assertCanOpen(id, { username: req.user!.username })).pipe(switchMap(() => this.live.stream(id)));
  }
}
