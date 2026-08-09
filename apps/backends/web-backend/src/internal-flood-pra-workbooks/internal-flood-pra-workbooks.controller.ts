import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { InternalFloodPraWorkbooksService, type InternalFloodPraWorkbookResponse } from "./internal-flood-pra-workbooks.service";
import { parseWorkbookPatchBody } from "../workbooks/workbook-mef-patch";

interface LoadExampleBody { example?: string }

@Controller("internal-flood-pra-workbooks")
@UseGuards(JwtAuthGuard)
export class InternalFloodPraWorkbooksController {
  constructor(private readonly workbooksService: InternalFloodPraWorkbooksService) {}
  @Get(":id") @HttpCode(HttpStatus.OK) get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<InternalFloodPraWorkbookResponse> { return this.workbooksService.findOne(id, { username: req.user!.username }); }
  @Patch(":id") @HttpCode(HttpStatus.OK) update(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest): Promise<InternalFloodPraWorkbookResponse> { return this.workbooksService.patchMef(id, parseWorkbookPatchBody(body), { username: req.user!.username }); }
  @Post(":id/load-example") @HttpCode(HttpStatus.OK) loadExample(@Param("id") id: string, @Body() body: LoadExampleBody, @Req() req: AuthenticatedRequest): Promise<InternalFloodPraWorkbookResponse> { return this.workbooksService.loadExample(id, { username: req.user!.username }, body.example); }
  @Post(":id/unload-example") @HttpCode(HttpStatus.OK) unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<InternalFloodPraWorkbookResponse> { return this.workbooksService.unloadExample(id, { username: req.user!.username }); }
}
