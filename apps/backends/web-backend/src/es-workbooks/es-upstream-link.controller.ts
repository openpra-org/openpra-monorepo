import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsUpstreamLinkService, type EsUpstreamLinkStatus } from "./es-upstream-link.service";

interface LinkIeBody { ieWorkbookId: string; }
interface LinkPosBody { posWorkbookId: string; }

@Controller("es-workbooks/:id/upstream-link")
@UseGuards(JwtAuthGuard)
export class EsUpstreamLinkController {
  constructor(private readonly esUpstreamLinkService: EsUpstreamLinkService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  status(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsUpstreamLinkStatus> {
    return this.esUpstreamLinkService.status(id, { username: req.user!.username });
  }

  @Post("link-ie")
  @HttpCode(HttpStatus.OK)
  linkIe(@Param("id") id: string, @Body() body: LinkIeBody, @Req() req: AuthenticatedRequest): Promise<EsUpstreamLinkStatus> {
    return this.esUpstreamLinkService.linkIe(id, body.ieWorkbookId, { username: req.user!.username });
  }

  @Post("link-pos")
  @HttpCode(HttpStatus.OK)
  linkPos(@Param("id") id: string, @Body() body: LinkPosBody, @Req() req: AuthenticatedRequest): Promise<EsUpstreamLinkStatus> {
    return this.esUpstreamLinkService.linkPos(id, body.posWorkbookId, { username: req.user!.username });
  }

  @Post("unlink")
  @HttpCode(HttpStatus.OK)
  unlink(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsUpstreamLinkStatus> {
    return this.esUpstreamLinkService.unlinkAll(id, { username: req.user!.username });
  }
}
