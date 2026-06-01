import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { IePosLinkService, type AvailablePosWorkbook, type IePosLinkStatus } from "./ie-pos-link.service";

interface LinkBody {
  posWorkbookId?: string;
}

@Controller("ie-workbooks/:id/pos-link")
@UseGuards(JwtAuthGuard)
export class IePosLinkController {
  constructor(private readonly iePosLinkService: IePosLinkService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  status(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<IePosLinkStatus> {
    return this.iePosLinkService.status(id, { username: req.user!.username });
  }

  @Get("available")
  @HttpCode(HttpStatus.OK)
  available(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<AvailablePosWorkbook[]> {
    return this.iePosLinkService.availablePos(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  link(@Param("id") id: string, @Body() body: LinkBody, @Req() req: AuthenticatedRequest): Promise<IePosLinkStatus> {
    if (typeof body.posWorkbookId !== "string" || body.posWorkbookId.length === 0) throw new BadRequestException("posWorkbookId is required");
    return this.iePosLinkService.link(id, body.posWorkbookId, { username: req.user!.username });
  }

  @Post("unlink")
  @HttpCode(HttpStatus.OK)
  unlink(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<IePosLinkStatus> {
    return this.iePosLinkService.unlink(id, { username: req.user!.username });
  }
}
