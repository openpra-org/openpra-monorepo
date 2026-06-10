import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { SyWorkbooksService, type SyWorkbookResponse } from "./sy-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

@Controller("sy-workbooks")
@UseGuards(JwtAuthGuard)
export class SyWorkbooksController {
  constructor(private readonly syWorkbooksService: SyWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.loadExample(id, { username: req.user!.username });
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
