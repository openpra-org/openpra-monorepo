import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { MsWorkbooksService, type MsWorkbookResponse } from "./ms-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

@Controller("ms-workbooks")
@UseGuards(JwtAuthGuard)
export class MsWorkbooksController {
  constructor(private readonly msWorkbooksService: MsWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<MsWorkbookResponse> {
    return this.msWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<MsWorkbookResponse> {
    return this.msWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<MsWorkbookResponse> {
    return this.msWorkbooksService.loadExample(id, { username: req.user!.username });
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<MsWorkbookResponse> {
    return this.msWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
