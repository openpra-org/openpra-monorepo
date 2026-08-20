import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { EsIeLinkService, type AvailableIeWorkbook, type EsIeLinkStatus } from "./es-ie-link.service";

interface LinkBody {
  ieWorkbookId?: string;
}

@Controller("es-workbooks/:id/ie-link")
@UseGuards(JwtAuthGuard)
export class EsIeLinkController {
  constructor(private readonly esIeLinkService: EsIeLinkService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  status(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsIeLinkStatus> {
    return this.esIeLinkService.status(id, { username: req.user!.username });
  }

  @Get("available")
  @HttpCode(HttpStatus.OK)
  available(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<AvailableIeWorkbook[]> {
    return this.esIeLinkService.availableIe(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  link(@Param("id") id: string, @Body() body: LinkBody, @Req() req: AuthenticatedRequest): Promise<EsIeLinkStatus> {
    if (typeof body.ieWorkbookId !== "string" || body.ieWorkbookId.length === 0) throw new BadRequestException("ieWorkbookId is required");
    return this.esIeLinkService.link(id, body.ieWorkbookId, { username: req.user!.username });
  }

  @Post("unlink")
  @HttpCode(HttpStatus.OK)
  unlink(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<EsIeLinkStatus> {
    return this.esIeLinkService.unlink(id, { username: req.user!.username });
  }
}
