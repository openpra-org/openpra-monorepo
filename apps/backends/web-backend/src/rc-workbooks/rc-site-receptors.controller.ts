import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcSiteReceptorsService } from "./rc-site-receptors.service";

@Controller("rc-workbooks/:id/site-receptors")
@UseGuards(JwtAuthGuard)
export class RcSiteReceptorsController {
  constructor(private readonly sites: RcSiteReceptorsService) {}
  @Post("import/:kind")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 } }))
  importFile(@Param("id") id: string, @Param("kind") kind: string, @Body("baseRevision") revision: string | undefined,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Req() req: AuthenticatedRequest) {
    if (!file || revision === undefined || !/^\d+$/.test(revision) || !["location", "geometry"].includes(kind)) throw new BadRequestException("Provide file, baseRevision and location or geometry input kind");
    return this.sites.importFile(id, kind as "location" | "geometry", Number(revision), file, { username: req.user!.username });
  }
  @Patch()
  save(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) { return this.sites.save(id, body, { username: req.user!.username }); }
  @Get("files/:documentId")
  original(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest) { return this.sites.original(id, documentId, { username: req.user!.username }); }
  @Get("points")
  points(@Param("id") id: string, @Query("offset") offset = "0", @Query("limit") limit = "100", @Req() req: AuthenticatedRequest) { return this.sites.points(id, Number(offset), Number(limit), { username: req.user!.username }); }
}
