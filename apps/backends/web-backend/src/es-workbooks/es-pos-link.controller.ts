import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsPosLinkService, type AvailablePosWorkbook, type EsPosLinkStatus } from "./es-pos-link.service";

interface LinkBody {
  posWorkbookId?: string;
}

@Controller("es-workbooks/:id/pos-link")
@UseGuards(JwtAuthGuard)
export class EsPosLinkController {
  constructor(private readonly esPosLinkService: EsPosLinkService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  status(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsPosLinkStatus> {
    return this.esPosLinkService.status(id, { username: req.user!.username });
  }

  @Get("available")
  @HttpCode(HttpStatus.OK)
  available(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<AvailablePosWorkbook[]> {
    return this.esPosLinkService.availablePos(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  link(@Param("id") id: string, @Body() body: LinkBody, @Req() req: AuthenticatedRequest): Promise<EsPosLinkStatus> {
    if (typeof body.posWorkbookId !== "string" || body.posWorkbookId.length === 0) throw new BadRequestException("posWorkbookId is required");
    return this.esPosLinkService.link(id, body.posWorkbookId, { username: req.user!.username });
  }

  @Post("unlink")
  @HttpCode(HttpStatus.OK)
  unlink(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsPosLinkStatus> {
    return this.esPosLinkService.unlink(id, { username: req.user!.username });
  }
}
