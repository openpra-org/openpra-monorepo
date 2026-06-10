import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { DaDocumentsService, type DaDocumentEntry } from "./da-documents.service";

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller("da-workbooks/:id/documents")
@UseGuards(JwtAuthGuard)
export class DaDocumentsController {
  constructor(private readonly daDocumentsService: DaDocumentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<DaDocumentEntry[]> {
    return this.daDocumentsService.list(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @Param("id") id: string,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<DaDocumentEntry> {
    if (file === undefined) throw new BadRequestException("file field is required");
    return this.daDocumentsService.upload(
      id,
      { buffer: file.buffer, mimeType: file.mimetype, size: file.size, originalName: file.originalname },
      { username: req.user!.username },
    );
  }

  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.daDocumentsService.remove(id, documentId, { username: req.user!.username });
  }

  @Get(":documentId/download")
  @HttpCode(HttpStatus.OK)
  download(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<{ url: string; filename: string }> {
    return this.daDocumentsService.presignedDownload(id, documentId, { username: req.user!.username });
  }
}
