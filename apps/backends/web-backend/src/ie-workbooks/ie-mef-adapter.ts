import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { IE_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { IeWorkbooksService } from "./ie-workbooks.service";
import { IeWorkbook, type IeWorkbookDocument } from "./ie-workbook.schema";
import { createBlankIe } from "./blank-ie";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class IeMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "IE";

  constructor(
    @InjectModel(IeWorkbook.name) private readonly ieWorkbookModel: Model<IeWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly ieWorkbooksService: IeWorkbooksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankIe(name, ownerUsername);
    await this.ieWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.ieWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.ieWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("IE workbook not found");
    const parsed = InitiatingEventsAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid IE workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }

  exampleVariants(): WorkbookExampleVariant[] {
    return IE_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.ieWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
