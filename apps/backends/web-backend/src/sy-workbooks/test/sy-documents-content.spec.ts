import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException } from "@nestjs/common";
import { Client } from "minio";
import { Readable } from "stream";
import { SyDocumentsService, byteRange } from "../sy-documents.service";
import { ProjectsService } from "../../projects/projects.service";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";

function query<T>(value: T): { exec: jest.Mock } {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe("SyDocumentsService content", () => {
  const environment = { ...process.env };
  let service: SyDocumentsService;
  let fileModel: { findOne: jest.Mock };

  beforeEach(async () => {
    process.env["MINIO_ENDPOINT"] = "localhost";
    process.env["MINIO_ACCESS_KEY"] = "access";
    process.env["MINIO_SECRET_KEY"] = "secret";
    jest.spyOn(Client.prototype, "bucketExists").mockResolvedValue(true);
    fileModel = { findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SyDocumentsService,
        { provide: getModelToken("SyWorkbook"), useValue: { findOne: jest.fn().mockReturnValue(query({ workbookId: "sy-1", projectId: "project-1" })) } },
        { provide: getModelToken("SyWorkbookFile"), useValue: fileModel },
        { provide: ProjectsService, useValue: { resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "viewer" }) } },
        { provide: WorkbookRolesService, useValue: { resolveEffectiveRoles: jest.fn().mockResolvedValue(["reviewer"]) } },
      ],
    }).compile();

    service = moduleRef.get(SyDocumentsService);
    service.onModuleInit();
  });

  afterEach(() => {
    process.env = { ...environment };
    jest.restoreAllMocks();
  });

  it("streams a stored document to a project member who can only read", async () => {
    const stream = Readable.from([Buffer.from("%PDF-1.7")]);
    fileModel.findOne.mockReturnValue(query({ documentId: "doc-1", minioKey: "sy-1/doc-1-design.pdf", mimeType: "application/pdf", size: 8 }));
    const getObject = jest.spyOn(Client.prototype, "getObject").mockResolvedValue(stream);

    await expect(service.content("sy-1", "doc-1", { username: "ada" })).resolves.toEqual({ stream, mimeType: "application/pdf", size: 8, range: null });
    expect(fileModel.findOne).toHaveBeenCalledWith({ workbookId: "sy-1", documentId: "doc-1" });
    expect(getObject).toHaveBeenCalledWith("sy-workbook-documents", "sy-1/doc-1-design.pdf");
  });

  it("reads only the requested bytes", async () => {
    const stream = Readable.from([Buffer.from("DF-1")]);
    fileModel.findOne.mockReturnValue(query({ documentId: "doc-1", minioKey: "sy-1/doc-1-design.pdf", mimeType: "application/pdf", size: 8 }));
    const getPartialObject = jest.spyOn(Client.prototype, "getPartialObject").mockResolvedValue(stream);

    await expect(service.content("sy-1", "doc-1", { username: "ada" }, "bytes=2-5")).resolves.toEqual({ stream, mimeType: "application/pdf", size: 8, range: { start: 2, end: 5 } });
    expect(getPartialObject).toHaveBeenCalledWith("sy-workbook-documents", "sy-1/doc-1-design.pdf", 2, 4);
  });

  it("parses byte ranges the way PDF viewers send them", () => {
    expect(byteRange("bytes=0-65535", 100000)).toEqual({ start: 0, end: 65535 });
    expect(byteRange("bytes=99000-", 100000)).toEqual({ start: 99000, end: 99999 });
    expect(byteRange("bytes=-500", 100000)).toEqual({ start: 99500, end: 99999 });
    expect(byteRange("bytes=90000-200000", 100000)).toEqual({ start: 90000, end: 99999 });
    expect(byteRange("bytes=100000-", 100000)).toBeNull();
    expect(byteRange("bytes=5-2", 100000)).toBeNull();
    expect(byteRange("items=0-5", 100000)).toBeNull();
    expect(byteRange(undefined, 100000)).toBeNull();
  });

  it("rejects a document that is not in the workbook", async () => {
    fileModel.findOne.mockReturnValue(query(null));

    await expect(service.content("sy-1", "missing", { username: "ada" })).rejects.toBeInstanceOf(NotFoundException);
  });
});
