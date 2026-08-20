import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RiWorkbooksService, type RiWorkbookResponse } from "./ri-workbooks.service";
import { parseWorkbookPatchBody } from "../workbooks/workbook-mef-patch";


interface LoadExampleBody {
  example?: string;
}

@Controller("ri-workbooks")
@UseGuards(JwtAuthGuard)
export class RiWorkbooksController {
  constructor(private readonly riWorkbooksService: RiWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<RiWorkbookResponse> {
    return this.riWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<RiWorkbookResponse> {
    return this.riWorkbooksService.patchMef(id, parseWorkbookPatchBody(body), { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: LoadExampleBody, @Req() req: AuthenticatedRequest): Promise<RiWorkbookResponse> {
    return this.riWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<RiWorkbookResponse> {
    return this.riWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
