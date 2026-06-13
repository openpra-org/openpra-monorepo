import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RiDocumentsService, type RiDocumentEntry } from "./ri-documents.service";

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller("ri-workbooks/:id/documents")
@UseGuards(JwtAuthGuard)
export class RiDocumentsController {
  constructor(private readonly riDocumentsService: RiDocumentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<RiDocumentEntry[]> {
    return this.riDocumentsService.list(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @Param("id") id: string,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<RiDocumentEntry> {
    if (file === undefined) throw new BadRequestException("file field is required");
    return this.riDocumentsService.upload(
      id,
      { buffer: file.buffer, mimeType: file.mimetype, size: file.size, originalName: file.originalname },
      { username: req.user!.username },
    );
  }

  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.riDocumentsService.remove(id, documentId, { username: req.user!.username });
  }

  @Get(":documentId/download")
  @HttpCode(HttpStatus.OK)
  download(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<{ url: string; filename: string }> {
    return this.riDocumentsService.presignedDownload(id, documentId, { username: req.user!.username });
  }
}
