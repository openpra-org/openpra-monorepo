import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { DaWorkbooksService, type DaWorkbookResponse } from "./da-workbooks.service";
import { parseRevisionedWorkbookPatchBody } from "../workbooks/workbook-mef-patch";


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
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<DaWorkbookResponse> {
    return this.daWorkbooksService.patchMef(id, parseRevisionedWorkbookPatchBody(body), { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: { example?: string }, @Req() req: AuthenticatedRequest): Promise<DaWorkbookResponse> {
    return this.daWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<DaWorkbookResponse> {
    return this.daWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
