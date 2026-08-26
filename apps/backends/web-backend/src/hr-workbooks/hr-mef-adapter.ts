import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HumanReliabilityAnalysisSchema } from "interfaces-mef-types/zod/hr/human-reliability-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { HR_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { HrWorkbooksService } from "./hr-workbooks.service";
import { HrWorkbook, type HrWorkbookDocument } from "./hr-workbook.schema";
import { createBlankHr } from "./blank-hr";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import {
  assertExpectedWorkbookRevision,
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";

@Injectable()
export class HrMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "HRA";

  constructor(
    @InjectModel(HrWorkbook.name) private readonly hrWorkbookModel: Model<HrWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly hrWorkbooksService: HrWorkbooksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankHr(name, ownerUsername);
    await this.hrWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown; revision: number } | null> {
    const doc = await this.hrWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return {
      projectId: doc.projectId,
      ownerUsername: doc.ownerUsername,
      mef: doc.mef,
      revision: readWorkbookRevision(doc),
    };
  }

  async save(workbookId: string, mef: unknown, expectedRevision?: number): Promise<unknown> {
    const doc = await this.hrWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("HR workbook not found");
    if (expectedRevision === undefined) throw new BadRequestException("Expected HR workbook revision is required");
    assertExpectedWorkbookRevision(doc, expectedRevision);
    const parsed = HumanReliabilityAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid HR workbook payload: ${parsed.error.message}`);
    const updated = await this.hrWorkbookModel
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
    return HR_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.hrWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
