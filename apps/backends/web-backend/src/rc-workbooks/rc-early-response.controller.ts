import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcEarlyResponseService } from "./rc-early-response.service";

@Controller("rc-workbooks/:id/early-response")
@UseGuards(JwtAuthGuard)
export class RcEarlyResponseController {
  constructor(private readonly responses: RcEarlyResponseService) {}
  @Patch()
  save(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.responses.save(id, body, { username: req.user!.username });
  }
  @Post("import")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 } }))
  importFile(@Param("id") id: string, @Body("baseRevision") revision: string | undefined,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Req() req: AuthenticatedRequest) {
    if (!file || revision === undefined || !/^\d+$/.test(revision)) throw new BadRequestException("Provide file and baseRevision");
    return this.responses.importFile(id, Number(revision), file, { username: req.user!.username });
  }
  @Get("files/:documentId")
  original(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest) {
    return this.responses.original(id, documentId, { username: req.user!.username });
  }
  @Post("calculate")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 1 } }))
  calculate(@Param("id") id: string, @Body("categoryId") categoryId: string | undefined,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Req() req: AuthenticatedRequest) {
    if (!categoryId || !file) throw new BadRequestException("Provide release category and response calculation file");
    return this.responses.calculate(id, categoryId, file, { username: req.user!.username });
  }
}
