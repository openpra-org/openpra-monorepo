import { RcPublishedExampleService } from "../rc-published-example.service";
import { RcCaseRecordsService } from "../rc-case-records.service";
import { RcCaseRecordsController } from "../rc-case-records.controller";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Test } from "@nestjs/testing";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Model } from "mongoose";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ProjectsService } from "../../projects/projects.service";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";
import { WorkbookElementRegistry } from "../../workbooks/workbook-element-registry";
import { WorkbookSignoff, WorkbookSignoffSchema } from "../../workbooks/workbook-signoff.schema";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { RcWorkbook, RcWorkbookSchema, type RcWorkbookDocument } from "../rc-workbook.schema";
import { RcWorkbookFile, RcWorkbookFileSchema, type RcWorkbookDocumentDocument } from "../rc-workbook-document.schema";
import { RcDocumentsService } from "../rc-documents.service";
import { RcDocumentsController } from "../rc-documents.controller";
import { RcSourceTermService } from "../rc-source-term.service";
import { RcSourceTermController } from "../rc-source-term.controller";
import { RcSiteReceptorsController } from "../rc-site-receptors.controller";
import { RcSiteReceptorsService } from "../rc-site-receptors.service";
import { RcWeatherService } from "../rc-weather.service";
import { RcWeatherController } from "../rc-weather.controller";
import { RcTransportController } from "../rc-transport.controller";
import { RcDoseInputsService } from "../rc-dose-inputs.service";
import { RcDoseInputsController } from "../rc-dose-inputs.controller";
import { RcTransportService } from "../rc-transport.service";
import { Readable } from "stream";
import { RcWorkbooksController } from "../rc-workbooks.controller";
import { RcWorkbooksService } from "../rc-workbooks.service";
import { RcMefAdapter } from "../rc-mef-adapter";
import { createBlankRc } from "../blank-rc";

export const sourceFixture = readFileSync(resolve(__dirname, "../../../../../interfaces/shared-types/rc-workbooks/test/fixtures/MelMACCS-published-source-term.inp"));

export async function createSourceTermTestApp() {
  const mongo = await MongoMemoryServer.create();
  const storage = new Map<string, Buffer>();
  const init = jest.spyOn(RcDocumentsService.prototype, "onModuleInit").mockImplementation(() => undefined);
  const module = await Test.createTestingModule({
    imports: [MongooseModule.forRoot(mongo.getUri()), MongooseModule.forFeature([
      { name: RcWorkbook.name, schema: RcWorkbookSchema },
      { name: RcWorkbookFile.name, schema: RcWorkbookFileSchema },
      { name: WorkbookSignoff.name, schema: WorkbookSignoffSchema },
    ])],
    controllers: [RcCaseRecordsController, RcSourceTermController, RcWorkbooksController, RcDocumentsController, RcSiteReceptorsController, RcWeatherController, RcTransportController, RcDoseInputsController],
    providers: [RcPublishedExampleService, RcCaseRecordsService, RcSourceTermService, RcDocumentsService, RcWorkbooksService, RcMefAdapter, WorkbookElementRegistry, RcSiteReceptorsService, RcWeatherService, RcTransportService, RcDoseInputsService,
      { provide: ExampleWorkbooksService, useValue: { getRcBundle: async () => ({ rc: { mef: createBlankRc("Example", "preparer") } }) } },
      { provide: ProjectsService, useValue: { resolveAccess: async (_id: string, actor: { username: string }) => {
        if (actor.username === "outsider") throw new ForbiddenException();
        return { role: actor.username === "viewer" ? "viewer" : "editor" };
      } } },
      { provide: WorkbookRolesService, useValue: { resolveEffectiveRoles: async (_id: string, name: string) => [name] } },
    ],
  }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest(); req.user = { username: req.headers["x-test-user"] ?? "preparer" }; return true;
  } }).compile();
  const app = module.createNestApplication<NestExpressApplication>();
  app.useBodyParser("json", { limit: "12mb" });
  try { await app.init(); } finally { init.mockRestore(); }
  const workbooks = module.get<Model<RcWorkbookDocument>>(getModelToken(RcWorkbook.name));
  const files = module.get<Model<RcWorkbookDocumentDocument>>(getModelToken(RcWorkbookFile.name));
  const documents = module.get(RcDocumentsService);
  Object.defineProperty(documents, "bucket", { value: "test" });
  Object.defineProperty(documents, "client", { value: {
    putObject: async (_bucket: string, key: string, bytes: Buffer) => { storage.set(key, Buffer.from(bytes)); },
    removeObject: async (_bucket: string, key: string) => { storage.delete(key); },
    presignedGetObject: async (_bucket: string, key: string) => `http://storage.test/${encodeURIComponent(key)}`,
    getObject: async (_bucket: string, key: string) => Readable.from([storage.get(key)!]),
  } });
  async function reset() {
    await workbooks.deleteMany({}).exec(); await files.deleteMany({}).exec(); storage.clear();
    const mef = createBlankRc("Test RC", "preparer");
    mef.releaseCategoryToConsequence.releaseCategoryInputs = ["RC-1", "RC-2"].map((releaseCategory) => ({
      releaseCategory, sourceTermDefinitionRef: `Source ${releaseCategory}`,
      releaseCharacteristics: { importantRadionuclides: ["I-131"], releaseUncertainties: "Keep this existing basis" },
    }));
    await workbooks.create({ workbookId: "rc-test", projectId: "project", ownerUsername: "preparer", mef });
    return mef;
  }
  return { app, workbooks, files, storage, documents, reset, close: async () => { await app.close(); await mongo.stop(); } };
}
