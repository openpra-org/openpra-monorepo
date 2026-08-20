import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { reviewBlockingExternalFloodPraDiagnostics, synchronizeExternalFloodPraDerivedRegisters } from "interfaces-mef-types/external-flood/external-flood-pra-validation";
import { ExternalFloodPRASchema } from "interfaces-mef-types/zod/external-flood/external-flood-pra";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { EXTERNAL_FLOOD_PRA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { createBlankExternalFloodPra } from "./blank-external-flood-pra";
import { ExternalFloodPraWorkbook, type ExternalFloodPraWorkbookDocument } from "./external-flood-pra-workbook.schema";
import { ExternalFloodPraWorkbooksService } from "./external-flood-pra-workbooks.service";

@Injectable()
export class ExternalFloodPraMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "XF";

  constructor(
    @InjectModel(ExternalFloodPraWorkbook.name) private readonly workbookModel: Model<ExternalFloodPraWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly workbooksService: ExternalFloodPraWorkbooksService,
  ) {}

  onModuleInit(): void { this.registry.register(this); }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    await this.workbookModel.create({ workbookId, projectId, ownerUsername, mef: createBlankExternalFloodPra(name, ownerUsername) });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    return doc ? { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef } : null;
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("External Flood PRA workbook not found");
    const parsed = ExternalFloodPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid External Flood PRA workbook payload: ${parsed.error.message}`);
    doc.mef = synchronizeExternalFloodPraDerivedRegisters(parsed.data);
    await doc.save();
    return doc.mef;
  }

  validateForReview(mef: object): string[] {
    const parsed = ExternalFloodPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) return ["The External Flood PRA data does not conform to its MEF schema."];
    return reviewBlockingExternalFloodPraDiagnostics(parsed.data).map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
  }

  exampleVariants(): WorkbookExampleVariant[] { return EXTERNAL_FLOOD_PRA_EXAMPLES.map((example) => ({ exampleId: example.id, label: example.label, workbookName: exampleWorkbookName(example.slug) })); }
  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> { await this.workbooksService.loadExample(workbookId, acting, exampleId); }
}
