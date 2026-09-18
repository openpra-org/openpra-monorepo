import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { RcCaseSelection } from "interfaces-mef-types/rc/case-records";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcCaseRecordsService } from "./rc-case-records.service";
@Controller("rc-workbooks/:id/case-records")
@UseGuards(JwtAuthGuard)
export class RcCaseRecordsController {
  constructor(private readonly cases: RcCaseRecordsService) {}
  @Get("review")
  review(@Param("id") id: string, @Query() selection: RcCaseSelection, @Req() req: AuthenticatedRequest) { return this.cases.review(id, selection, { username: req.user!.username }); }
  @Post("snapshots") @HttpCode(200)
  saveSnapshot(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) { return this.cases.saveSnapshot(id, body, { username: req.user!.username }); }
  @Post("results") @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 1, fieldSize: 16384 } }))
  saveResult(@Param("id") id: string, @Body() body: { record?: string }, @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Req() req: AuthenticatedRequest) {
    if (!file) throw new BadRequestException("Select an original text output");
    let record: unknown;
    try { record = JSON.parse(body.record ?? ""); } catch { throw new BadRequestException("Provide the linked result values"); }
    return this.cases.saveResult(id, record, file, { username: req.user!.username });
  }
  @Get("table/:kind")
  table(@Param("id") id: string, @Param("kind") kind: string, @Query() query: RcCaseSelection & { offset?: string }, @Req() req: AuthenticatedRequest) {
    const { offset = "0", ...selection } = query;
    return this.cases.table(id, selection, kind, Number(offset), { username: req.user!.username });
  }
  @Get("text/:fileId")
  text(@Param("id") id: string, @Param("fileId") fileId: string, @Query() query: RcCaseSelection & { offset?: string }, @Req() req: AuthenticatedRequest) {
    const { offset = "0", ...selection } = query;
    return this.cases.text(id, selection, fileId, Number(offset), { username: req.user!.username });
  }
  @Get("snapshots/:snapshotId/choices/:kind")
  choices(@Param("id") id: string, @Param("snapshotId") snapshotId: string, @Param("kind") kind: string, @Query("search") search = "", @Req() req: AuthenticatedRequest) {
    return this.cases.choices(id, snapshotId, kind, search, { username: req.user!.username });
  }
  @Get("results/:resultId/output")
  output(@Param("id") id: string, @Param("resultId") resultId: string, @Query("offset") offset = "0", @Req() req: AuthenticatedRequest) { return this.cases.output(id, resultId, Number(offset), { username: req.user!.username }); }
}
