import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Client } from "minio";
import { Model } from "mongoose";
import { randomUUID } from "crypto";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcWorkbookFile, type RcWorkbookDocumentDocument } from "./rc-workbook-document.schema";

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

export interface RcDocumentEntry {
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
export class RcDocumentsService implements OnModuleInit {
  private readonly logger = new Logger(RcDocumentsService.name);
  private client!: Client;
  private bucket!: string;

  constructor(
    @InjectModel(RcWorkbook.name) private readonly rcWorkbookModel: Model<RcWorkbookDocument>,
    @InjectModel(RcWorkbookFile.name) private readonly rcDocModel: Model<RcWorkbookDocumentDocument>,
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
  ) {}

  onModuleInit(): void {
    const endpoint = process.env["MINIO_ENDPOINT"];
    const portRaw = process.env["MINIO_PORT"];
    const useSslRaw = process.env["MINIO_USE_SSL"];
    const accessKey = process.env["MINIO_ACCESS_KEY"];
    const secretKey = process.env["MINIO_SECRET_KEY"];
    const bucket = process.env["MINIO_RC_DOCUMENTS_BUCKET"] ?? "rc-workbook-documents";

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

  private async loadAuthorize(workbookId: string, acting: ActingUser, requireWrite: boolean): Promise<{ myRoles: WorkbookRoleName[] }> {
    const wb = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("RC workbook not found");
    const { role } = await this.projectsService.resolveAccess(wb.projectId, acting);
    if (requireWrite && role === "viewer") throw new ForbiddenException("You cannot modify documents on this workbook");
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    return { myRoles };
  }

  async list(workbookId: string, acting: ActingUser): Promise<RcDocumentEntry[]> {
    await this.loadAuthorize(workbookId, acting, false);
    const docs = await this.rcDocModel.find({ workbookId, sourceTermOriginal: { $ne: true }, siteInputOriginal: { $ne: true }, responseInputOriginal: { $ne: true }, weatherInputOriginal: { $ne: true }, transportInputOriginal: { $ne: true }, doseInputOriginal: { $ne: true }, caseArtifactOriginal: { $ne: true } }).sort({ createdAt: 1 }).exec();
    return docs.map((d) => ({
      documentId: d.documentId,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.size,
      uploadedBy: d.uploadedBy,
      uploadedAt: d.createdAt.toISOString(),
    }));
  }

  async upload(workbookId: string, input: UploadInput, acting: ActingUser, sourceTermOriginal = false, siteInputOriginal = false, weatherInputOriginal = false, transportInputOriginal = false, doseInputOriginal = false, caseArtifactOriginal = false, responseInputOriginal = false): Promise<RcDocumentEntry> {
    const { myRoles } = await this.loadAuthorize(workbookId, acting, true);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can upload documents");
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) throw new BadRequestException(`Unsupported file type: ${input.mimeType}`);
    if (input.size > MAX_BYTES) throw new BadRequestException(`File exceeds ${MAX_BYTES} bytes`);
    if (input.size <= 0) throw new BadRequestException("Empty file");

    const documentId = randomUUID();
    const minioKey = `${workbookId}/${documentId}-${input.originalName}`;
    await this.client.putObject(this.bucket, minioKey, input.buffer, input.size, { "Content-Type": input.mimeType });
    const created = await this.rcDocModel.create({
      documentId,
      workbookId,
      filename: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      minioKey,
      uploadedBy: acting.username,
      sourceTermOriginal,
      siteInputOriginal,
      weatherInputOriginal,
      transportInputOriginal,
      doseInputOriginal,
      caseArtifactOriginal,
      responseInputOriginal,
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
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can delete documents");
    const doc = await this.rcDocModel.findOne({ workbookId, documentId }).exec();
    if (!doc) throw new NotFoundException("Document not found");
    if (doc.caseArtifactOriginal) throw new ForbiddenException("Case snapshots and linked outputs are retained with the workbook");
    if (doc.sourceTermOriginal) throw new ForbiddenException("Source-term originals are retained with the workbook");
    if (doc.siteInputOriginal) throw new ForbiddenException("Site-input originals are retained with the workbook");
    if (doc.responseInputOriginal) throw new ForbiddenException("Response-input originals are retained with the workbook");
    if (doc.weatherInputOriginal) throw new ForbiddenException("Weather-input originals are retained with the workbook");
    if (doc.doseInputOriginal) throw new ForbiddenException("Dose-input originals are retained with the workbook");
    if (doc.transportInputOriginal) throw new ForbiddenException("Transport-input originals are retained with the workbook");
    try {
      await this.client.removeObject(this.bucket, doc.minioKey);
    } catch (err) {
      this.logger.warn(`Failed to remove object ${doc.minioKey}`, err);
    }
    await doc.deleteOne();
  }

  async presignedDownload(workbookId: string, documentId: string, acting: ActingUser): Promise<{ url: string; filename: string }> {
    await this.loadAuthorize(workbookId, acting, false);
    const doc = await this.rcDocModel.findOne({ workbookId, documentId }).exec();
    if (!doc) throw new NotFoundException("Document not found");
    const url = await this.client.presignedGetObject(this.bucket, doc.minioKey, 60 * 5);
    return { url, filename: doc.filename };
  }

  /** Roll back a failed import; never remove an original already linked to saved data. */
  async discardUnlinkedSourceOriginal(workbookId: string, documentId: string): Promise<void> {
    return this.discardUnlinkedInputOriginal(workbookId, documentId);
  }

  async discardUnlinkedInputOriginal(workbookId: string, documentId: string): Promise<void> {
    const workbook = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (workbook && (JSON.stringify(workbook.mef).includes(documentId) || workbook.previousMefJson?.includes(documentId))) return;
    const file = await this.rcDocModel.findOne({ workbookId, documentId, $or: [{ sourceTermOriginal: true }, { siteInputOriginal: true }, { responseInputOriginal: true }, { weatherInputOriginal: true }, { transportInputOriginal: true }, { doseInputOriginal: true }, { caseArtifactOriginal: true }] }).exec();
    if (!file) return;
    await this.client.removeObject(this.bucket, file.minioKey);
    await file.deleteOne();
  }

  async removeAllForWorkbook(workbookId: string, preserveSourceTerms = false): Promise<void> {
    const filter = { workbookId, ...(preserveSourceTerms ? { sourceTermOriginal: { $ne: true }, siteInputOriginal: { $ne: true }, responseInputOriginal: { $ne: true }, weatherInputOriginal: { $ne: true }, transportInputOriginal: { $ne: true }, doseInputOriginal: { $ne: true }, caseArtifactOriginal: { $ne: true } } : {}) };
    const docs = await this.rcDocModel.find(filter).exec();
    for (const d of docs) {
      try { await this.client.removeObject(this.bucket, d.minioKey); } catch (err) { this.logger.warn(`Failed to remove ${d.minioKey}`, err); }
    }
    await this.rcDocModel.deleteMany(filter).exec();
  }

  async readSiteInput(workbookId: string, documentId: string, acting: ActingUser): Promise<Buffer> {
    return this.readInputOriginal(workbookId, documentId, acting, "siteInputOriginal", 5 * 1024 * 1024);
  }

  async readResponseInput(workbookId: string, documentId: string, acting: ActingUser): Promise<Buffer> {
    return this.readInputOriginal(workbookId, documentId, acting, "responseInputOriginal", 5 * 1024 * 1024);
  }

  async readWeatherInput(workbookId: string, documentId: string, acting: ActingUser): Promise<Buffer> {
    return this.readInputOriginal(workbookId, documentId, acting, "weatherInputOriginal", 8 * 1024 * 1024);
  }

  async readSourceInput(workbookId: string, documentId: string, acting: ActingUser): Promise<Buffer> {
    return this.readInputOriginal(workbookId, documentId, acting, "sourceTermOriginal", 2 * 1024 * 1024);
  }

  async readTransportInput(workbookId: string, documentId: string, acting: ActingUser): Promise<Buffer> {
    return this.readInputOriginal(workbookId, documentId, acting, "transportInputOriginal", 12 * 1024 * 1024);
  }

  async readDoseInput(workbookId: string, documentId: string, acting: ActingUser): Promise<Buffer> {
    return this.readInputOriginal(workbookId, documentId, acting, "doseInputOriginal", 15 * 1024 * 1024);
  }

  async readCaseArtifact(workbookId: string, documentId: string, acting: ActingUser): Promise<Buffer> {
    return this.readInputOriginal(workbookId, documentId, acting, "caseArtifactOriginal", 50 * 1024 * 1024);
  }

  private async readInputOriginal(workbookId: string, documentId: string, acting: ActingUser, kind: "siteInputOriginal" | "responseInputOriginal" | "weatherInputOriginal" | "sourceTermOriginal" | "transportInputOriginal" | "doseInputOriginal" | "caseArtifactOriginal", maxBytes: number): Promise<Buffer> {
    await this.loadAuthorize(workbookId, acting, false);
    const doc = await this.rcDocModel.findOne({ workbookId, documentId, [kind]: true }).exec();
    if (!doc) throw new NotFoundException("Input file not found");
    const stream = await this.client.getObject(this.bucket, doc.minioKey);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk); size += bytes.length;
      if (size > maxBytes) { stream.destroy(); throw new BadRequestException("Input file exceeds the size limit"); }
      chunks.push(bytes);
    }
    return Buffer.concat(chunks);
  }
}
