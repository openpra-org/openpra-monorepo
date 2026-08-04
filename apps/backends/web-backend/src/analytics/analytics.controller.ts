import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";
import { AnalyticsService, type ClientUsageEvent, type RangeQuery } from "./analytics.service";

@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("config")
  config(): { idleThresholdSeconds: number } {
    return { idleThresholdSeconds: Number(process.env["ANALYTICS_IDLE_THRESHOLD_SECONDS"] ?? 120) };
  }

  @Post("events")
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(
    @Body() body: { events?: ClientUsageEvent[] },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ accepted: number }> {
    return this.analytics.ingest(body.events ?? [], { userId: req.user!.sub, username: req.user!.username });
  }
}

@Controller("campaigns")
export class PublicCampaignController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post(":token/open")
  @HttpCode(HttpStatus.OK)
  open(
    @Param("token") token: string,
    @Body() body: { visitorId?: string },
  ): Promise<{ name: string; destinationPath: string; token: string }> {
    return this.analytics.openCampaign(token, body.visitorId ?? "");
  }
}

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("metrics")
  metrics(
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("reactorType") reactorType?: string,
  ): Promise<Record<string, unknown>> {
    return this.analytics.dashboard({ start, end, reactorType });
  }

  @Get("metrics.csv")
  async csv(
    @Res() response: Response,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("reactorType") reactorType?: string,
  ): Promise<void> {
    const csv = await this.analytics.dashboardCsv({ start, end, reactorType });
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="openpra-analytics-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send(csv);
  }

  @Get("campaigns")
  campaigns(): Promise<Record<string, unknown>[]> {
    return this.analytics.listCampaigns();
  }

  @Post("campaigns")
  @HttpCode(HttpStatus.CREATED)
  createCampaign(
    @Body() body: { name?: string; destinationPath?: string; expiresAt?: string | null },
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    return this.analytics.createCampaign(body, req.user!.username);
  }

  @Patch("campaigns/:id")
  campaignState(
    @Param("id") id: string,
    @Body() body: { active?: boolean },
  ): Promise<Record<string, unknown>> {
    return this.analytics.setCampaignActive(id, body.active === true);
  }

  @Get("users")
  users(): Promise<Array<Record<string, unknown>>> {
    return this.analytics.listAdminUsers();
  }

  @Patch("users/:id/admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminState(
    @Param("id") id: string,
    @Body() body: { isAdmin?: boolean },
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.analytics.setAdmin(id, body.isAdmin === true, { userId: req.user!.sub, username: req.user!.username });
  }
}
