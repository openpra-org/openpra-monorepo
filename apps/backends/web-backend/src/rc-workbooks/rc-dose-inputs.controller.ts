import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { RcDosePathway } from "interfaces-mef-types/rc/dose-inputs";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcDoseInputsService } from "./rc-dose-inputs.service";
@Controller("rc-workbooks/:id/dose-inputs")
@UseGuards(JwtAuthGuard)
export class RcDoseInputsController {
  constructor(private readonly dose: RcDoseInputsService) {}
  @Post("import/:kind")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 3 } }))
  import(@Param("id") id: string, @Param("kind") kind: string, @Body() body: { baseRevision?: string; sourceRevision?: string; categoryId?: string },
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Req() req: AuthenticatedRequest) {
    if (!file || !["exposure", "inhalation", "cloudshine", "groundshine"].includes(kind) || !/^\d+$/.test(body.baseRevision ?? "") || body.sourceRevision !== undefined && !/^\d+$/.test(body.sourceRevision)) throw new BadRequestException("Provide a dose input file, its type and the current revision");
    return this.dose.importFile(id, kind as "exposure" | RcDosePathway, { baseRevision: Number(body.baseRevision), sourceRevision: body.sourceRevision === undefined ? undefined : Number(body.sourceRevision), categoryId: body.categoryId }, file, { username: req.user!.username });
  }
  @Patch()
  save(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) { return this.dose.save(id, body, { username: req.user!.username }); }
  @Get("files/:documentId")
  original(@Param("id") id: string, @Param("documentId") documentId: string, @Query("offset") offset = "0", @Req() req: AuthenticatedRequest) { return this.dose.original(id, documentId, Number(offset), { username: req.user!.username }); }
  @Get("records/:documentId")
  records(@Param("id") id: string, @Param("documentId") documentId: string, @Query("nuclide") nuclide: string, @Req() req: AuthenticatedRequest) { return this.dose.records(id, documentId, nuclide, { username: req.user!.username }); }
}
