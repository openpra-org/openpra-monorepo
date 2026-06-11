import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsqWorkbooksService, type EsqWorkbookResponse } from "./esq-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

@Controller("esq-workbooks")
@UseGuards(JwtAuthGuard)
export class EsqWorkbooksController {
  constructor(private readonly esqWorkbooksService: EsqWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.loadExample(id, { username: req.user!.username });
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsqWorkbookResponse> {
    return this.esqWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
