import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { NotificationsResponse, UnreadCountResponse } from "interfaces-shared-types";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Req() req: AuthenticatedRequest): Promise<NotificationsResponse> {
    return this.notificationsService.list(req.user!.username);
  }

  @Get("unread-count")
  @HttpCode(HttpStatus.OK)
  unreadCount(@Req() req: AuthenticatedRequest): Promise<UnreadCountResponse> {
    return this.notificationsService.unreadCount(req.user!.username);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAll(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.notificationsService.markAllRead(req.user!.username);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.notificationsService.markRead(id, req.user!.username);
  }
}
