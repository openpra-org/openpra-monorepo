import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { ESQ_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { EsqWorkbooksService } from "./esq-workbooks.service";
import { EsqWorkbook, type EsqWorkbookDocument } from "./esq-workbook.schema";
import { createBlankEsq } from "./blank-esq";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class EsqMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "ESQ";

  constructor(
    @InjectModel(EsqWorkbook.name) private readonly esqWorkbookModel: Model<EsqWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly esqWorkbooksService: EsqWorkbooksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankEsq(name, ownerUsername);
    await this.esqWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("ESQ workbook not found");
    const parsed = EventSequenceQuantificationSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid ESQ workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }

  exampleVariants(): WorkbookExampleVariant[] {
    return ESQ_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.esqWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
