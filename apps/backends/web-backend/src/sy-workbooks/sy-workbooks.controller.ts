import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { SyWorkbooksService, type SyWorkbookResponse } from "./sy-workbooks.service";
import { parseWorkbookPatchBody } from "../workbooks/workbook-mef-patch";


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
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.patchMef(id, parseWorkbookPatchBody(body), { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: { example?: string }, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SyWorkbookResponse> {
    return this.syWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
