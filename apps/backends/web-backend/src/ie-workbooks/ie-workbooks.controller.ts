import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { IeWorkbooksService, type IeWorkbookResponse } from "./ie-workbooks.service";

interface ReplaceMefBody {
  mef: unknown;
}

interface LoadExampleBody {
  example?: string;
}

@Controller("ie-workbooks")
@UseGuards(JwtAuthGuard)
export class IeWorkbooksController {
  constructor(private readonly ieWorkbooksService: IeWorkbooksService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<IeWorkbookResponse> {
    return this.ieWorkbooksService.findOne(id, { username: req.user!.username });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Param("id") id: string,
    @Body() body: ReplaceMefBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<IeWorkbookResponse> {
    return this.ieWorkbooksService.replaceMef(id, body.mef, { username: req.user!.username });
  }

  @Post(":id/load-example")
  @HttpCode(HttpStatus.OK)
  loadExample(@Param("id") id: string, @Body() body: LoadExampleBody, @Req() req: AuthenticatedRequest): Promise<IeWorkbookResponse> {
    return this.ieWorkbooksService.loadExample(id, { username: req.user!.username }, body.example);
  }

  @Post(":id/unload-example")
  @HttpCode(HttpStatus.OK)
  unloadExample(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<IeWorkbookResponse> {
    return this.ieWorkbooksService.unloadExample(id, { username: req.user!.username });
  }
}
