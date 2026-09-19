import { BadRequestException, Body, Controller, HttpCode, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcSourceTermService } from "./rc-source-term.service";

@Controller("rc-workbooks/:id/source-terms/:categoryId")
@UseGuards(JwtAuthGuard)
export class RcSourceTermController {
  constructor(private readonly sourceTerms: RcSourceTermService) {}

  @Post("import")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 1 } }))
  importFile(@Param("id") id: string, @Param("categoryId") categoryId: string,
    @Body("baseRevision") revision: string | undefined,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Req() req: AuthenticatedRequest) {
    if (!file || revision === undefined || !/^\d+$/.test(revision)) throw new BadRequestException("file and baseRevision are required");
    return this.sourceTerms.importFile(id, categoryId, Number(revision), file, { username: req.user!.username });
  }

  @Patch()
  save(@Param("id") id: string, @Param("categoryId") categoryId: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.sourceTerms.save(id, categoryId, body, { username: req.user!.username });
  }
}
