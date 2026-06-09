import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ScWorkbooksService, type ScWorkbookResponse } from "./sc-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

@Controller("sc-workbooks")
@UseGuards(JwtAuthGuard)
export class ScWorkbooksController {
  constructor(private readonly scWorkbooksService: ScWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<ScWorkbookResponse> {
    return this.scWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScWorkbookResponse> {
    return this.scWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<ScWorkbookResponse> {
    return this.scWorkbooksService.loadExample(id, { username: req.user!.username });
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<ScWorkbookResponse> {
    return this.scWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
