import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { DA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { DaWorkbooksService } from "./da-workbooks.service";
import { DaWorkbook, type DaWorkbookDocument } from "./da-workbook.schema";
import { createBlankDa } from "./blank-da";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import {
  assertExpectedWorkbookRevision,
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";

@Injectable()
export class DaMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "DA";

  constructor(
    @InjectModel(DaWorkbook.name) private readonly daWorkbookModel: Model<DaWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly daWorkbooksService: DaWorkbooksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankDa(name, ownerUsername);
    await this.daWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown; revision: number } | null> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef, revision: readWorkbookRevision(doc) };
  }

  async save(workbookId: string, mef: unknown, expectedRevision?: number): Promise<unknown> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("DA workbook not found");
    if (expectedRevision === undefined) throw new BadRequestException("Expected DA workbook revision is required");
    assertExpectedWorkbookRevision(doc, expectedRevision);
    const parsed = DataAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid DA workbook payload: ${parsed.error.message}`);
    const updated = await this.daWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        { $set: { mef: parsed.data, revision: expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw workbookRevisionConflict(expectedRevision);
    return parsed.data;
  }

  exampleVariants(): WorkbookExampleVariant[] {
    return DA_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.daWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
