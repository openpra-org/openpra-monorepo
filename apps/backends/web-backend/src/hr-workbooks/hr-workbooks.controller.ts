import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { HrWorkbooksService, type HrWorkbookResponse } from "./hr-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

@Controller("hr-workbooks")
@UseGuards(JwtAuthGuard)
export class HrWorkbooksController {
  constructor(private readonly hrWorkbooksService: HrWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<HrWorkbookResponse> {
    return this.hrWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<HrWorkbookResponse> {
    return this.hrWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: { example?: string }, @Req() req: AuthenticatedRequest): Promise<HrWorkbookResponse> {
    return this.hrWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<HrWorkbookResponse> {
    return this.hrWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
