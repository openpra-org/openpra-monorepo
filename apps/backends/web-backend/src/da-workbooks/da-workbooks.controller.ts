import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { DaWorkbooksService, type DaWorkbookResponse } from "./da-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

@Controller("da-workbooks")
@UseGuards(JwtAuthGuard)
export class DaWorkbooksController {
  constructor(private readonly daWorkbooksService: DaWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<DaWorkbookResponse> {
    return this.daWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<DaWorkbookResponse> {
    return this.daWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<DaWorkbookResponse> {
    return this.daWorkbooksService.loadExample(id, { username: req.user!.username });
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<DaWorkbookResponse> {
    return this.daWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
