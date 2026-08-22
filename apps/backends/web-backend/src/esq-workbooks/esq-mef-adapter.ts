import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { ESQ_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { EsqWorkbooksService } from "./esq-workbooks.service";
import { EsqWorkbook, type EsqWorkbookDocument } from "./esq-workbook.schema";
import { createBlankEsq } from "./blank-esq";
import { normalizeEsqMef } from "./esq-mef-normalize";
import {
  assertExpectedWorkbookRevision,
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";

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

  async load(workbookId: string): Promise<{
    projectId: string;
    ownerUsername: string;
    mef: unknown;
    revision: number;
  } | null> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return {
      projectId: doc.projectId,
      ownerUsername: doc.ownerUsername,
      mef: doc.mef,
      revision: readWorkbookRevision(doc),
    };
  }

  async save(workbookId: string, mef: unknown, expectedRevision?: number): Promise<unknown> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("ESQ workbook not found");
    if (expectedRevision === undefined) {
      throw new BadRequestException("Expected ESQ workbook revision is required");
    }
    assertExpectedWorkbookRevision(doc, expectedRevision);
    const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid ESQ workbook payload: ${parsed.error.message}`);
    const updated = await this.esqWorkbookModel
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
    return ESQ_EXAMPLES.map((e) => ({ exampleId: e.id, label: e.label, workbookName: exampleWorkbookName(e.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.esqWorkbooksService.loadExample(workbookId, acting, exampleId);
  }
}
