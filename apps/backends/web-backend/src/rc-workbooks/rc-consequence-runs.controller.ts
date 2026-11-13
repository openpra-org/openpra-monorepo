import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { RcConsequenceRunRecordRequest, RcConsequenceRunRequest } from "interfaces-mef-types/rc/consequence-runs";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcConsequenceRunsService, type RunTrialQuery } from "./rc-consequence-runs.service";

function actorOf(request: AuthenticatedRequest): { username: string } {
  return { username: request.user?.username ?? "" };
}

@Controller("rc-workbooks/:id/consequence-runs")
@UseGuards(JwtAuthGuard)
class RcConsequenceRunsController {
  constructor(private readonly runs: RcConsequenceRunsService) {}

  @Get()
  list(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.runs.list(id, actorOf(request));
  }

  @Get("setup")
  setup(@Param("id") id: string, @Query("snapshotId") snapshotId = "", @Req() request: AuthenticatedRequest) {
    return this.runs.setup(id, snapshotId, actorOf(request));
  }

  @Post()
  @HttpCode(200)
  start(@Param("id") id: string, @Body() body: RcConsequenceRunRequest, @Req() request: AuthenticatedRequest) {
    return this.runs.start(id, body, actorOf(request));
  }

  @Get(":runId")
  details(@Param("id") id: string, @Param("runId") runId: string, @Req() request: AuthenticatedRequest) {
    return this.runs.details(id, runId, actorOf(request));
  }

  @Get(":runId/trials")
  trials(@Param("id") id: string, @Param("runId") runId: string, @Query() query: RunTrialQuery, @Req() request: AuthenticatedRequest) {
    return this.runs.trials(id, runId, query, actorOf(request));
  }

  @Get(":runId/files/:kind")
  file(
    @Param("id") id: string,
    @Param("runId") runId: string,
    @Param("kind") kind: string,
    @Query("offset") offset = "0",
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.file(id, runId, kind, offset, actorOf(request));
  }

  @Post(":runId/cancel")
  @HttpCode(200)
  cancel(@Param("id") id: string, @Param("runId") runId: string, @Req() request: AuthenticatedRequest) {
    return this.runs.cancel(id, runId, actorOf(request));
  }

  @Post(":runId/remove")
  @HttpCode(200)
  remove(@Param("id") id: string, @Param("runId") runId: string, @Req() request: AuthenticatedRequest) {
    return this.runs.remove(id, runId, actorOf(request));
  }

  @Post(":runId/record")
  @HttpCode(200)
  record(
    @Param("id") id: string,
    @Param("runId") runId: string,
    @Body() body: RcConsequenceRunRecordRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.record(id, runId, body, actorOf(request));
  }
}

export { RcConsequenceRunsController };
