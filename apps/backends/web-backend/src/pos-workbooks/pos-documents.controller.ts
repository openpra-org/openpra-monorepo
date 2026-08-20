import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PosDocumentsService, type PosDocumentEntry } from "./pos-documents.service";

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

interface UpdateDocumentBody {
  name?: string;
  notes?: string;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller("pos-workbooks/:id/documents")
@UseGuards(JwtAuthGuard)
export class PosDocumentsController {
  constructor(private readonly posDocumentsService: PosDocumentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<PosDocumentEntry[]> {
    return this.posDocumentsService.list(id, { username: req.user!.username });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @Param("id") id: string,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<PosDocumentEntry> {
    if (file === undefined) throw new BadRequestException("file field is required");
    return this.posDocumentsService.upload(
      id,
      { buffer: file.buffer, mimeType: file.mimetype, size: file.size, originalName: file.originalname },
      { username: req.user!.username },
    );
  }

  @Patch(":documentId")
  @HttpCode(HttpStatus.OK)
  update(@Param("id") id: string, @Param("documentId") documentId: string, @Body() body: UpdateDocumentBody, @Req() req: AuthenticatedRequest): Promise<PosDocumentEntry> {
    return this.posDocumentsService.update(id, documentId, { name: body.name, notes: body.notes }, { username: req.user!.username });
  }

  @Delete(":documentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.posDocumentsService.remove(id, documentId, { username: req.user!.username });
  }

  @Get(":documentId/download")
  @HttpCode(HttpStatus.OK)
  download(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest): Promise<{ url: string; filename: string }> {
    return this.posDocumentsService.presignedDownload(id, documentId, { username: req.user!.username });
  }
}
