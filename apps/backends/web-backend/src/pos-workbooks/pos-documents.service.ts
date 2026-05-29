import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Client } from "minio";
import { Model } from "mongoose";
import { randomUUID } from "crypto";
import { ProjectsService } from "../projects/projects.service";
import { PosWorkbook, type PosWorkbookDocument } from "./pos-workbook.schema";
import { PosWorkbookRole, type PosWorkbookRoleDocument, type PosWorkbookRoleName } from "./pos-workbook-role.schema";
import { PosWorkbookFile, type PosWorkbookDocumentDocument } from "./pos-workbook-document.schema";

const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
]);

const MAX_BYTES = 50 * 1024 * 1024;

export interface PosDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  size: number;
  originalName: string;
}

interface ActingUser {
  username: string;
}

@Injectable()
export class PosDocumentsService implements OnModuleInit {
  private readonly logger = new Logger(PosDocumentsService.name);
  private client!: Client;
  private bucket!: string;

  constructor(
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    @InjectModel(PosWorkbookRole.name) private readonly posRoleModel: Model<PosWorkbookRoleDocument>,
    @InjectModel(PosWorkbookFile.name) private readonly posDocModel: Model<PosWorkbookDocumentDocument>,
    private readonly projectsService: ProjectsService,
  ) {}

  onModuleInit(): void {
    const endpoint = process.env["MINIO_ENDPOINT"];
    const portRaw = process.env["MINIO_PORT"];
    const useSslRaw = process.env["MINIO_USE_SSL"];
    const accessKey = process.env["MINIO_ACCESS_KEY"];
    const secretKey = process.env["MINIO_SECRET_KEY"];
    const bucket = process.env["MINIO_POS_DOCUMENTS_BUCKET"] ?? "pos-workbook-documents";

    if (!endpoint) throw new Error("MINIO_ENDPOINT is required but not set");
    if (!accessKey) throw new Error("MINIO_ACCESS_KEY is required but not set");
    if (!secretKey) throw new Error("MINIO_SECRET_KEY is required but not set");

    const port = portRaw !== undefined && portRaw.length > 0 ? Number(portRaw) : undefined;
    const useSSL = useSslRaw === "true";

    this.client = new Client({ endPoint: endpoint, port, useSSL, accessKey, secretKey });
    this.bucket = bucket;
    void this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, "us-east-1");
        this.logger.log(`Created bucket: ${this.bucket}`);
      }
    } catch (err) {
      this.logger.error(`Bucket bootstrap failed for "${this.bucket}"`, err);
    }
  }

  private async loadAuthorize(workbookId: string, acting: ActingUser, requireWrite: boolean): Promise<{ myRoles: PosWorkbookRoleName[] }> {
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { role } = await this.projectsService.resolveAccess(wb.projectId, acting);
    if (requireWrite && role === "viewer") throw new ForbiddenException("You cannot modify documents on this workbook");
    const roleDocs = await this.posRoleModel.find({ workbookId, username: acting.username }).exec();
    return { myRoles: roleDocs.map((d) => d.role) };
  }

  async list(workbookId: string, acting: ActingUser): Promise<PosDocumentEntry[]> {
    await this.loadAuthorize(workbookId, acting, false);
    const docs = await this.posDocModel.find({ workbookId }).sort({ createdAt: 1 }).exec();
    return docs.map((d) => ({
      documentId: d.documentId,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.size,
      uploadedBy: d.uploadedBy,
      uploadedAt: d.createdAt.toISOString(),
    }));
  }

  async upload(workbookId: string, input: UploadInput, acting: ActingUser): Promise<PosDocumentEntry> {
    const { myRoles } = await this.loadAuthorize(workbookId, acting, true);
    if (!myRoles.includes("preparer")) throw new ForbiddenException("Only preparers can upload documents");
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) throw new BadRequestException(`Unsupported file type: ${input.mimeType}`);
    if (input.size > MAX_BYTES) throw new BadRequestException(`File exceeds ${MAX_BYTES} bytes`);
    if (input.size <= 0) throw new BadRequestException("Empty file");

    const documentId = randomUUID();
    const minioKey = `${workbookId}/${documentId}-${input.originalName}`;
    await this.client.putObject(this.bucket, minioKey, input.buffer, input.size, { "Content-Type": input.mimeType });
    const created = await this.posDocModel.create({
      documentId,
      workbookId,
      filename: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      minioKey,
      uploadedBy: acting.username,
    });
    return {
      documentId,
      filename: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      uploadedBy: acting.username,
      uploadedAt: created.createdAt.toISOString(),
    };
  }

  async remove(workbookId: string, documentId: string, acting: ActingUser): Promise<void> {
    const { myRoles } = await this.loadAuthorize(workbookId, acting, true);
    if (!myRoles.includes("preparer")) throw new ForbiddenException("Only preparers can delete documents");
    const doc = await this.posDocModel.findOne({ workbookId, documentId }).exec();
    if (!doc) throw new NotFoundException("Document not found");
    try {
      await this.client.removeObject(this.bucket, doc.minioKey);
    } catch (err) {
      this.logger.warn(`Failed to remove object ${doc.minioKey}`, err);
    }
    await doc.deleteOne();
  }

  async presignedDownload(workbookId: string, documentId: string, acting: ActingUser): Promise<{ url: string; filename: string }> {
    await this.loadAuthorize(workbookId, acting, false);
    const doc = await this.posDocModel.findOne({ workbookId, documentId }).exec();
    if (!doc) throw new NotFoundException("Document not found");
    const url = await this.client.presignedGetObject(this.bucket, doc.minioKey, 60 * 5);
    return { url, filename: doc.filename };
  }

  async removeAllForWorkbook(workbookId: string): Promise<void> {
    const docs = await this.posDocModel.find({ workbookId }).exec();
    for (const d of docs) {
      try { await this.client.removeObject(this.bucket, d.minioKey); } catch (err) { this.logger.warn(`Failed to remove ${d.minioKey}`, err); }
    }
    await this.posDocModel.deleteMany({ workbookId }).exec();
  }
}
