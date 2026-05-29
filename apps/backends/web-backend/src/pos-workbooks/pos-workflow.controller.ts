import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PosWorkflowService, type PosWorkflowStatus } from "./pos-workflow.service";
import type { PosSignoffRole } from "./pos-workbook-signoff.schema";

const VALID_SIGNOFF_ROLES: PosSignoffRole[] = ["preparer", "co_preparer", "reviewer", "approver"];

interface SignAsBody {
  role: PosSignoffRole;
}

interface RequestRevisionBody {
  note?: string;
}

@Controller("pos-workbooks")
@UseGuards(JwtAuthGuard)
export class PosWorkflowController {
  constructor(private readonly posWorkflowService: PosWorkflowService) {}

  @Get("awaiting-me")
  @HttpCode(HttpStatus.OK)
  awaitingMe(@Req() req: AuthenticatedRequest): Promise<{ workbookId: string; projectId: string; workflowState: string; pendingAction: string }[]> {
    return this.posWorkflowService.awaitingMe({ username: req.user!.username });
  }

  @Get(":id/workflow")
  @HttpCode(HttpStatus.OK)
  status(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<PosWorkflowStatus> {
    return this.posWorkflowService.status(id, { username: req.user!.username });
  }

  @Post(":id/workflow/submit-for-review")
  @HttpCode(HttpStatus.OK)
  submit(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.posWorkflowService.submitForReview(id, { username: req.user!.username });
  }

  @Post(":id/workflow/sign-review")
  @HttpCode(HttpStatus.OK)
  signReview(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.posWorkflowService.signReview(id, { username: req.user!.username });
  }

  @Post(":id/workflow/sign-approval")
  @HttpCode(HttpStatus.OK)
  signApproval(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.posWorkflowService.signApproval(id, { username: req.user!.username });
  }

  @Post(":id/workflow/request-revision")
  @HttpCode(HttpStatus.OK)
  requestRevision(@Param("id") id: string, @Body() body: RequestRevisionBody, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.posWorkflowService.requestRevision(id, body.note ?? "", { username: req.user!.username });
  }

  @Post(":id/workflow/sign-as")
  @HttpCode(HttpStatus.OK)
  signAs(@Param("id") id: string, @Body() body: SignAsBody, @Req() req: AuthenticatedRequest): Promise<unknown> {
    if (!VALID_SIGNOFF_ROLES.includes(body.role)) throw new BadRequestException("Invalid signoff role");
    return this.posWorkflowService.signAs(id, body.role, { username: req.user!.username });
  }
}
