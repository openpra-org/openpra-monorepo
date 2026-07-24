import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Client } from "minio";
import { Model } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { SeismicPraWorkbookFile, type SeismicPraWorkbookDocumentDocument } from "./seismic-pra-workbook-document.schema";
import { SeismicPraWorkbook, type SeismicPraWorkbookDocument } from "./seismic-pra-workbook.schema";

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

export interface SeismicPraDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

interface UploadInput { buffer: Buffer; mimeType: string; size: number; originalName: string }
interface ActingUser { username: string }

@Injectable()
export class SeismicPraDocumentsService implements OnModuleInit {
  private readonly logger = new Logger(SeismicPraDocumentsService.name);
  private client!: Client;
  private bucket!: string;

  constructor(
    @InjectModel(SeismicPraWorkbook.name) private readonly workbookModel: Model<SeismicPraWorkbookDocument>,
    @InjectModel(SeismicPraWorkbookFile.name) private readonly documentModel: Model<SeismicPraWorkbookDocumentDocument>,
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
  ) {}

  onModuleInit(): void {
    const endpoint = process.env["MINIO_ENDPOINT"];
    const accessKey = process.env["MINIO_ACCESS_KEY"];
    const secretKey = process.env["MINIO_SECRET_KEY"];
    if (!endpoint) throw new Error("MINIO_ENDPOINT is required but not set");
    if (!accessKey) throw new Error("MINIO_ACCESS_KEY is required but not set");
    if (!secretKey) throw new Error("MINIO_SECRET_KEY is required but not set");
    const portRaw = process.env["MINIO_PORT"];
    this.client = new Client({
      endPoint: endpoint,
      port: portRaw !== undefined && portRaw.length > 0 ? Number(portRaw) : undefined,
      useSSL: process.env["MINIO_USE_SSL"] === "true",
      accessKey,
      secretKey,
    });
    this.bucket = process.env["MINIO_SEISMIC_PRA_DOCUMENTS_BUCKET"] ?? "seismic-pra-workbook-documents";
    void this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      if (!(await this.client.bucketExists(this.bucket))) await this.client.makeBucket(this.bucket, "us-east-1");
    } catch (err) {
      this.logger.error(`Bucket bootstrap failed for "${this.bucket}"`, err);
    }
  }

  private async authorize(workbookId: string, acting: ActingUser, write: boolean): Promise<WorkbookRoleName[]> {
    const workbook = await this.workbookModel.findOne({ workbookId }).exec();
    if (!workbook) throw new NotFoundException("Seismic PRA workbook not found");
    const { role } = await this.projectsService.resolveAccess(workbook.projectId, acting);
    if (write && role === "viewer") throw new ForbiddenException("You cannot modify documents on this workbook");
    return this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
  }

  async list(workbookId: string, acting: ActingUser): Promise<SeismicPraDocumentEntry[]> {
    await this.authorize(workbookId, acting, false);
    const documents = await this.documentModel.find({ workbookId }).sort({ createdAt: 1 }).exec();
    return documents.map((document) => ({
      documentId: document.documentId,
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.size,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.createdAt.toISOString(),
    }));
  }

  async upload(workbookId: string, input: UploadInput, acting: ActingUser): Promise<SeismicPraDocumentEntry> {
    const roles = await this.authorize(workbookId, acting, true);
    if (!roles.includes("preparer") && !roles.includes("co_preparer")) throw new ForbiddenException("Only preparers can upload documents");
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) throw new BadRequestException(`Unsupported file type: ${input.mimeType}`);
    if (input.size > MAX_BYTES) throw new BadRequestException(`File exceeds ${MAX_BYTES} bytes`);
    if (input.size <= 0) throw new BadRequestException("Empty file");
    const documentId = randomUUID();
    const minioKey = `${workbookId}/${documentId}-${input.originalName}`;
    await this.client.putObject(this.bucket, minioKey, input.buffer, input.size, { "Content-Type": input.mimeType });
    const created = await this.documentModel.create({ documentId, workbookId, filename: input.originalName, mimeType: input.mimeType, size: input.size, minioKey, uploadedBy: acting.username });
    return { documentId, filename: created.filename, mimeType: created.mimeType, size: created.size, uploadedBy: created.uploadedBy, uploadedAt: created.createdAt.toISOString() };
  }

  async update(workbookId: string, documentId: string, requestedName: string | undefined, acting: ActingUser): Promise<SeismicPraDocumentEntry> {
    const roles = await this.authorize(workbookId, acting, true);
    if (!roles.includes("preparer") && !roles.includes("co_preparer")) throw new ForbiddenException("Only preparers can edit documents");
    const document = await this.documentModel.findOne({ workbookId, documentId }).exec();
    if (!document) throw new NotFoundException("Document not found");
    const name = requestedName?.trim() ?? "";
    if (name.length === 0) throw new BadRequestException("Document name cannot be empty");
    document.filename = name;
    await document.save();
    return {
      documentId: document.documentId,
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.size,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.createdAt.toISOString(),
    };
  }

  async remove(workbookId: string, documentId: string, acting: ActingUser): Promise<void> {
    const roles = await this.authorize(workbookId, acting, true);
    if (!roles.includes("preparer") && !roles.includes("co_preparer")) throw new ForbiddenException("Only preparers can delete documents");
    const document = await this.documentModel.findOne({ workbookId, documentId }).exec();
    if (!document) throw new NotFoundException("Document not found");
    try { await this.client.removeObject(this.bucket, document.minioKey); } catch (err) { this.logger.warn(`Failed to remove ${document.minioKey}`, err); }
    await document.deleteOne();
  }

  async presignedDownload(workbookId: string, documentId: string, acting: ActingUser): Promise<{ url: string; filename: string }> {
    await this.authorize(workbookId, acting, false);
    const document = await this.documentModel.findOne({ workbookId, documentId }).exec();
    if (!document) throw new NotFoundException("Document not found");
    return { url: await this.client.presignedGetObject(this.bucket, document.minioKey, 60 * 5), filename: document.filename };
  }

  async removeAllForWorkbook(workbookId: string): Promise<void> {
    const documents = await this.documentModel.find({ workbookId }).exec();
    for (const document of documents) {
      try { await this.client.removeObject(this.bucket, document.minioKey); } catch (err) { this.logger.warn(`Failed to remove ${document.minioKey}`, err); }
    }
    await this.documentModel.deleteMany({ workbookId }).exec();
  }
}
