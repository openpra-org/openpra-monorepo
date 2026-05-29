import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PosCommentsService } from "./pos-comments.service";

interface AddCommentBody {
  text: string;
  severity?: "MAJOR" | "MINOR" | "OBSERVATION";
  associatedSr?: string;
  associatedField?: string;
}

interface UpdateCommentBody {
  resolved?: boolean;
  resolution?: string;
}

@Controller("pos-workbooks/:id/comments")
@UseGuards(JwtAuthGuard)
export class PosCommentsController {
  constructor(private readonly posCommentsService: PosCommentsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  add(@Param("id") id: string, @Body() body: AddCommentBody, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.posCommentsService.addComment(id, body, { username: req.user!.username });
  }

  @Patch(":commentUuid")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Param("commentUuid") commentUuid: string,
    @Body() body: UpdateCommentBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.posCommentsService.updateComment(id, commentUuid, body, { username: req.user!.username });
  }
}
