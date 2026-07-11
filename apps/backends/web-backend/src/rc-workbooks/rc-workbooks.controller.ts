import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcWorkbooksService, type RcWorkbookResponse } from "./rc-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

interface LoadExampleBody {
  example?: string;
}

@Controller("rc-workbooks")
@UseGuards(JwtAuthGuard)
export class RcWorkbooksController {
  constructor(private readonly rcWorkbooksService: RcWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<RcWorkbookResponse> {
    return this.rcWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<RcWorkbookResponse> {
    return this.rcWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: LoadExampleBody, @Req() req: AuthenticatedRequest): Promise<RcWorkbookResponse> {
    return this.rcWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<RcWorkbookResponse> {
    return this.rcWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
