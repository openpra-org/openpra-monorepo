import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsWorkbooksService, type EsWorkbookResponse } from "./es-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

@Controller("es-workbooks")
@UseGuards(JwtAuthGuard)
export class EsWorkbooksController {
  constructor(private readonly esWorkbooksService: EsWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.loadExample(id, { username: req.user!.username });
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsWorkbookResponse> {
    return this.esWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
