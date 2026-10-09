import { readFileSync } from "fs";
import { join } from "path";
import { BadRequestException, ForbiddenException, Logger } from "@nestjs/common";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test, type TestingModule } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Model } from "mongoose";
import { stringifyJson } from "interfaces-shared-types/json";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { EsDocumentsService } from "../../es-workbooks/es-documents.service";
import { EsWorkbook, EsWorkbookSchema, type EsWorkbookDocument } from "../../es-workbooks/es-workbook.schema";
import { EsWorkbooksService } from "../../es-workbooks/es-workbooks.service";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { WorkbookDependencyDiscoveryService } from "../../newly-developed-methods/shared/workbook-dependency-discovery.service";
import { ProjectsService } from "../../projects/projects.service";
import { SyDocumentsService } from "../../sy-workbooks/sy-documents.service";
import { SyWorkbook, SyWorkbookSchema, type SyWorkbookDocument } from "../../sy-workbooks/sy-workbook.schema";
import { SyWorkbooksService } from "../../sy-workbooks/sy-workbooks.service";
import { olderFormatMessage } from "../stored-workbook-format";
import { field, isRecord, jsonRecordOf, type Json, type JsonRecord } from "../uncertainty-migration";
import { WorkbookModelAccessService } from "../workbook-model-access.service";
import { WorkbookRolesService } from "../workbook-roles.service";
import { WorkbookSignoff, WorkbookSignoffSchema } from "../workbook-signoff.schema";

const FIXTURES = jsonRecordOf(readFileSync(join(__dirname, "uncertainty-migration-fixtures.json"), "utf8"));

const ACTING = { username: "format-tester" };

function record(value: Json | undefined): JsonRecord {
  if (!isRecord(value)) throw new Error("Expected a JSON object.");
  return value;
}

function fixture(name: string): JsonRecord {
  return record(field(record(FIXTURES ?? null), name));
}

function blankEs(): JsonRecord {
  return record(jsonRecordOf(stringifyJson(createBlankEs("ES Workbook", ACTING.username))) ?? null);
}

async function rejection(work: Promise<object>): Promise<Error> {
  try {
    await work;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("The request did not fail.");
}

describe("stored workbooks in an older format", () => {
  let mongo: MongoMemoryServer;
  let moduleRef: TestingModule;
  let esModel: Model<EsWorkbookDocument>;
  let syModel: Model<SyWorkbookDocument>;
  let errors: jest.SpyInstance;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        MongooseModule.forFeature([
          { name: EsWorkbook.name, schema: EsWorkbookSchema },
          { name: SyWorkbook.name, schema: SyWorkbookSchema },
          { name: WorkbookSignoff.name, schema: WorkbookSignoffSchema },
        ]),
      ],
      providers: [
        EsWorkbooksService,
        SyWorkbooksService,
        { provide: ProjectsService, useValue: { resolveAccess: () => Promise.resolve({ role: "owner" }) } },
        { provide: WorkbookRolesService, useValue: { resolveEffectiveRoles: () => Promise.resolve(["preparer"]) } },
        { provide: ExampleWorkbooksService, useValue: {} },
        { provide: EsDocumentsService, useValue: {} },
        { provide: SyDocumentsService, useValue: {} },
        { provide: WorkbookModelAccessService, useValue: {} },
        { provide: WorkbookDependencyDiscoveryService, useValue: {} },
      ],
    }).compile();
    esModel = moduleRef.get<Model<EsWorkbookDocument>>(getModelToken(EsWorkbook.name));
    syModel = moduleRef.get<Model<SyWorkbookDocument>>(getModelToken(SyWorkbook.name));
  }, 120_000);

  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  }, 120_000);

  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
  });

  function logged(): string[] {
    return errors.mock.calls.map(([message]) => String(message));
  }

  it("answers a stored ES workbook that does not parse with a plain message and logs the details", async () => {
    const tree = { ...fixture("es-event-tree"), uuid: "ET-VALUE", initiatingEventFrequency: { value: 0.02 } };
    await esModel.create({ workbookId: "es-old", projectId: "project-format", ownerUsername: ACTING.username, mef: { ...blankEs(), eventTrees: [tree] } });

    const error = await rejection(moduleRef.get(EsWorkbooksService).findOne("es-old", ACTING));

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe("This workbook was saved in an older format and could not be converted. Workbook es-old. The server log has the details.");
    expect(olderFormatMessage("es-old")).toBe(error.message);
    expect(logged()).toHaveLength(1);
    expect(logged()[0]).toContain("Stored ES workbook es-old failed validation.");
    expect(logged()[0]).toContain("initiatingEventFrequency");
  }, 120_000);

  it("answers a stored SY workbook that does not parse with a plain message and logs the details", async () => {
    await syModel.create({ workbookId: "sy-old", projectId: "project-format", ownerUsername: ACTING.username, revision: 2, mef: fixture("sy-htgr") });

    const error = await rejection(moduleRef.get(SyWorkbooksService).findOne("sy-old", ACTING));

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe("This workbook was saved in an older format and could not be converted. Workbook sy-old. The server log has the details.");
    expect(logged()[0]).toContain("A component basic event keeps its value in the expression field");
  }, 120_000);

  it("keeps the forbidden status when the stored prior contents do not parse", async () => {
    const prior = { ...blankEs(), eventTrees: [{ ...fixture("es-event-tree"), uuid: "ET-PRIOR", initiatingEventFrequency: { value: 0.02 } }] };
    await esModel.create({ workbookId: "es-prior", projectId: "project-format", ownerUsername: ACTING.username, mef: blankEs(), previousMefJson: stringifyJson(prior) });

    const error = await rejection(moduleRef.get(EsWorkbooksService).unloadExample("es-prior", ACTING));

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe("This workbook was saved in an older format and could not be converted. Workbook es-prior. The server log has the details.");
    expect(logged()[0]).toContain("The prior contents of ES workbook es-prior failed validation.");
  }, 120_000);
});
