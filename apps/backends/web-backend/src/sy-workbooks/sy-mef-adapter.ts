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

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("SY workbook not found");
    const parsed = SystemsAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid SY workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }

  exampleVariants(): WorkbookExampleVariant[] {
    return SY_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.syWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
