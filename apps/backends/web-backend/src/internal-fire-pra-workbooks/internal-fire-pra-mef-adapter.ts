import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { reviewBlockingInternalFirePraDiagnostics, synchronizeInternalFirePraDerivedRegisters } from "interfaces-mef-types/internal-fire/internal-fire-pra-validation";
import { InternalFirePRASchema } from "interfaces-mef-types/zod/internal-fire/internal-fire-pra";
import { INTERNAL_FIRE_PRA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { createBlankInternalFirePra } from "./blank-internal-fire-pra";
import { InternalFirePraWorkbook, type InternalFirePraWorkbookDocument } from "./internal-fire-pra-workbook.schema";
import { InternalFirePraWorkbooksService } from "./internal-fire-pra-workbooks.service";

@Injectable()
export class InternalFirePraMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "F";

  constructor(
    @InjectModel(InternalFirePraWorkbook.name) private readonly workbookModel: Model<InternalFirePraWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly workbooksService: InternalFirePraWorkbooksService,
  ) {}

  onModuleInit(): void { this.registry.register(this); }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    await this.workbookModel.create({ workbookId, projectId, ownerUsername, mef: createBlankInternalFirePra(name, ownerUsername) });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    return doc ? { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef } : null;
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("Internal Fire PRA workbook not found");
    const parsed = InternalFirePRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid Internal Fire PRA workbook payload: ${parsed.error.message}`);
    doc.mef = synchronizeInternalFirePraDerivedRegisters(parsed.data);
    await doc.save();
    return doc.mef;
  }

  validateForReview(mef: object): string[] {
    const parsed = InternalFirePRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) return ["The Internal Fire PRA data does not conform to its MEF schema."];
    return reviewBlockingInternalFirePraDiagnostics(parsed.data).map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
  }

  exampleVariants(): WorkbookExampleVariant[] { return INTERNAL_FIRE_PRA_EXAMPLES.map((example) => ({ exampleId: example.id, label: example.label, workbookName: exampleWorkbookName(example.slug) })); }
  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> { await this.workbooksService.loadExample(workbookId, acting, exampleId); }
}
