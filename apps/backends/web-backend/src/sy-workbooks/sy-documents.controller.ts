import { BadRequestException, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Req, Res, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { SyDocumentsService, type SyDocumentEntry } from "./sy-documents.service";

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller("sy-workbooks/:id/documents")
@UseGuards(JwtAuthGuard)
export class SyDocumentsController {
  constructor(private readonly syDocumentsService: SyDocumentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SyDocumentEntry[]> {
    return this.syDocumentsService.list(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @Param("id") id: string,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<SyDocumentEntry> {
    if (file === undefined) throw new BadRequestException("file field is required");
    return this.syDocumentsService.upload(
      id,
      { buffer: file.buffer, mimeType: file.mimetype, size: file.size, originalName: file.originalname },
      { username: req.user!.username },
    );
  }

  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.syDocumentsService.remove(id, documentId, { username: req.user!.username });
  }

  @Get(":documentId/content")
  async content(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Headers("range") range: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.syDocumentsService.content(id, documentId, { username: req.user!.username }, range);
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Content-Type", file.mimeType);
    if (file.range === null) {
      response.status(HttpStatus.OK);
      response.setHeader("Content-Length", String(file.size));
    } else {
      response.status(HttpStatus.PARTIAL_CONTENT);
      response.setHeader("Content-Range", `bytes ${file.range.start}-${file.range.end}/${file.size}`);
      response.setHeader("Content-Length", String(file.range.end - file.range.start + 1));
    }
    file.stream.on("error", () => response.destroy());
    file.stream.pipe(response);
  }

  @Get(":documentId/download")
  @HttpCode(HttpStatus.OK)
  download(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<{ url: string; filename: string }> {
    return this.syDocumentsService.presignedDownload(id, documentId, { username: req.user!.username });
  }
}
