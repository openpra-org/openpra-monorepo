import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { ES_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { EsWorkbooksService } from "./es-workbooks.service";
import { EsWorkbook, type EsWorkbookDocument } from "./es-workbook.schema";
import { createBlankEs } from "./blank-es";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class EsMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "ES";

  constructor(
    @InjectModel(EsWorkbook.name) private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly esWorkbooksService: EsWorkbooksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankEs(name, ownerUsername);
    await this.esWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("ES workbook not found");
    const parsed = EventSequenceAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid ES workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }

  exampleVariants(): WorkbookExampleVariant[] {
    return ES_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.esWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
