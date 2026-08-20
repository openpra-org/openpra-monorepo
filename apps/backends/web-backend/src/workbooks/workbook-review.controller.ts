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
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { WorkbookRolesService, type WorkbookRolesResponse, type WorkbookRoleName } from "./workbook-roles.service";
import { WorkbookWorkflowService, type WorkbookWorkflowStatus } from "./workbook-workflow.service";
import { WorkbookCommentsService, type AddCommentBody, type UpdateCommentBody } from "./workbook-comments.service";
import { type WorkbookSignoffRole } from "./workbook-signoff.schema";

const VALID_ROLES: WorkbookRoleName[] = ["preparer", "co_preparer", "reviewer", "approver"];
const VALID_SIGNOFF_ROLES: WorkbookSignoffRole[] = ["preparer", "co_preparer", "reviewer", "approver"];

interface AssignBody {
  username?: string;
  teamId?: string;
  role: WorkbookRoleName;
  designation?: string;
}

interface SignAsBody {
  role: WorkbookSignoffRole;
  signatureDataUrl?: string;
}

interface RequestRevisionBody {
  note?: string;
}

@Controller("workbooks")
@UseGuards(JwtAuthGuard)
export class WorkbookReviewController {
  constructor(
    private readonly rolesService: WorkbookRolesService,
    private readonly workflowService: WorkbookWorkflowService,
    private readonly commentsService: WorkbookCommentsService,
  ) {}

  @Get("awaiting-me")
  @HttpCode(HttpStatus.OK)
  awaitingMe(@Req() req: AuthenticatedRequest): Promise<{ workbookId: string; projectId: string; workflowState: string; pendingAction: string }[]> {
    return this.workflowService.awaitingMe({ username: req.user!.username });
  }

  @Get(":id/roles")
  @HttpCode(HttpStatus.OK)
  listRoles(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<WorkbookRolesResponse> {
    return this.rolesService.list(id, { username: req.user!.username });
  }

  @Post(":id/roles")
  @HttpCode(HttpStatus.OK)
  assign(@Param("id") id: string, @Body() body: AssignBody, @Req() req: AuthenticatedRequest): Promise<WorkbookRolesResponse> {
    const hasUsername = typeof body.username === "string" && body.username.length > 0;
    const hasTeam = typeof body.teamId === "string" && body.teamId.length > 0;
    if (hasUsername === hasTeam) throw new BadRequestException("Specify exactly one of username or teamId");
    if (typeof body.role !== "string" || !VALID_ROLES.includes(body.role)) throw new BadRequestException("Valid role required");
    if (hasUsername) {
      return this.rolesService.assignUser(id, body.username!, body.role, { username: req.user!.username }, body.designation);
    }
    return this.rolesService.assignTeam(id, body.teamId!, body.role, { username: req.user!.username });
  }

  @Delete(":id/roles/user/:username/:role")
  @HttpCode(HttpStatus.OK)
  unassignUser(
    @Param("id") id: string,
    @Param("username") username: string,
    @Param("role") role: WorkbookRoleName,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkbookRolesResponse> {
    return this.rolesService.unassignUser(id, username, role, { username: req.user!.username });
  }

  @Delete(":id/roles/team/:teamId/:role")
  @HttpCode(HttpStatus.OK)
  unassignTeam(
    @Param("id") id: string,
    @Param("teamId") teamId: string,
    @Param("role") role: WorkbookRoleName,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkbookRolesResponse> {
    return this.rolesService.unassignTeam(id, teamId, role, { username: req.user!.username });
  }

  @Get(":id/workflow")
  @HttpCode(HttpStatus.OK)
  status(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<WorkbookWorkflowStatus> {
    return this.workflowService.status(id, { username: req.user!.username });
  }

  @Post(":id/workflow/submit-for-review")
  @HttpCode(HttpStatus.OK)
  submit(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.workflowService.submitForReview(id, { username: req.user!.username });
  }

  @Post(":id/workflow/sign-review")
  @HttpCode(HttpStatus.OK)
  signReview(@Param("id") id: string, @Body() body: { signatureDataUrl?: string }, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.workflowService.signReview(id, { username: req.user!.username }, body.signatureDataUrl);
  }

  @Post(":id/workflow/sign-approval")
  @HttpCode(HttpStatus.OK)
  signApproval(@Param("id") id: string, @Body() body: { signatureDataUrl?: string }, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.workflowService.signApproval(id, { username: req.user!.username }, body.signatureDataUrl);
  }

  @Post(":id/workflow/sign-as")
  @HttpCode(HttpStatus.OK)
  signAs(@Param("id") id: string, @Body() body: SignAsBody, @Req() req: AuthenticatedRequest): Promise<unknown> {
    if (!VALID_SIGNOFF_ROLES.includes(body.role)) throw new BadRequestException("Invalid signoff role");
    return this.workflowService.signAs(id, body.role, { username: req.user!.username }, body.signatureDataUrl);
  }

  @Post(":id/workflow/submit-to-approver")
  @HttpCode(HttpStatus.OK)
  submitToApprover(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.workflowService.submitToApprover(id, { username: req.user!.username });
  }

  @Post(":id/workflow/request-revision")
  @HttpCode(HttpStatus.OK)
  requestRevision(@Param("id") id: string, @Body() body: RequestRevisionBody, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.workflowService.requestRevision(id, body.note ?? "", { username: req.user!.username });
  }

  @Post(":id/comments")
  @HttpCode(HttpStatus.OK)
  addComment(@Param("id") id: string, @Body() body: AddCommentBody, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.commentsService.addComment(id, body, { username: req.user!.username });
  }

  @Patch(":id/comments/:commentUuid")
  @HttpCode(HttpStatus.OK)
  updateComment(
    @Param("id") id: string,
    @Param("commentUuid") commentUuid: string,
    @Body() body: UpdateCommentBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.commentsService.updateComment(id, commentUuid, body, { username: req.user!.username });
  }
}
