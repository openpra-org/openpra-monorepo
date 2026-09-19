import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { SY_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { SyWorkbooksService } from "./sy-workbooks.service";
import { SyWorkbook, type SyWorkbookDocument } from "./sy-workbook.schema";
import { createBlankSy } from "./blank-sy";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import {
  assertExpectedWorkbookRevision,
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";

@Injectable()
export class SyMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "SY";

  constructor(
    @InjectModel(SyWorkbook.name) private readonly syWorkbookModel: Model<SyWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly syWorkbooksService: SyWorkbooksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankSy(name, ownerUsername);
    await this.syWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{
    projectId: string;
    ownerUsername: string;
    mef: unknown;
    revision: number;
  } | null> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    const parsed = SystemsAnalysisSchema.safeParse(stripNulls(doc.mef));
    if (!parsed.success) throw new BadRequestException(`Stored SY workbook failed validation: ${parsed.error.message}`);
    return {
      projectId: doc.projectId,
      ownerUsername: doc.ownerUsername,
      mef: parsed.data,
      revision: readWorkbookRevision(doc),
    };
  }

  async save(workbookId: string, mef: unknown, expectedRevision?: number): Promise<unknown> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("SY workbook not found");
    if (expectedRevision === undefined) {
      throw new BadRequestException("Expected SY workbook revision is required");
    }
    assertExpectedWorkbookRevision(doc, expectedRevision);
    const parsed = SystemsAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid SY workbook payload: ${parsed.error.message}`);
    const updated = await this.syWorkbookModel
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
    return SY_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.syWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
