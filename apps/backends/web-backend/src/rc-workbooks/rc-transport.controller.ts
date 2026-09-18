import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcTransportService } from "./rc-transport.service";
@Controller("rc-workbooks/:id/transport")
@UseGuards(JwtAuthGuard)
export class RcTransportController {
  constructor(private readonly transport: RcTransportService) {}
  @Post("import/:kind")
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor("files", 8, { storage: memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 8, fields: 3 } }))
  importFiles(@Param("id") id: string, @Param("kind") kind: string, @Body() body: { baseRevision?: string; sourceRevision?: string; categoryId?: string },
    @UploadedFiles() files: { buffer: Buffer; originalname: string }[] | undefined, @Req() req: AuthenticatedRequest) {
    if (!files?.length || !/^\d+$/.test(body.baseRevision ?? "") || body.sourceRevision !== undefined && !/^\d+$/.test(body.sourceRevision) || !["deposition", "dispersion", "decay"].includes(kind))
      throw new BadRequestException("Provide transport files, an input kind and current revision");
    return this.transport.importFiles(id, kind as "deposition" | "dispersion" | "decay", { baseRevision: Number(body.baseRevision), sourceRevision: body.sourceRevision === undefined ? undefined : Number(body.sourceRevision), categoryId: body.categoryId }, files, { username: req.user!.username });
  }
  @Patch()
  save(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) { return this.transport.save(id, body, { username: req.user!.username }); }
  @Post("unlink")
  @HttpCode(200)
  unlink(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) { return this.transport.remove(id, body, { username: req.user!.username }); }
  @Get("source/:categoryId")
  source(@Param("id") id: string, @Param("categoryId") categoryId: string, @Req() req: AuthenticatedRequest) { return this.transport.linkedSource(id, categoryId, { username: req.user!.username }); }
  @Get("files/:documentId")
  original(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest) { return this.transport.original(id, documentId, { username: req.user!.username }); }
  @Get("decay/:documentId/:index")
  decay(@Param("id") id: string, @Param("documentId") documentId: string, @Param("index") index: string, @Query("offset") offset = "0", @Req() req: AuthenticatedRequest) {
    return this.transport.decayDetail(id, documentId, Number(index), Number(offset), { username: req.user!.username });
  }
}
