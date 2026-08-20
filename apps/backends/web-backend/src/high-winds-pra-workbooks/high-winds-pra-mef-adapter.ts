import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { reviewBlockingHighWindsPraDiagnostics, synchronizeHighWindsPraDerivedRegisters } from "interfaces-mef-types/high-winds/high-winds-pra-validation";
import { HighWindsPRASchema } from "interfaces-mef-types/zod/high-winds/high-winds-pra";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { HIGH_WINDS_PRA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { createBlankHighWindsPra } from "./blank-high-winds-pra";
import { HighWindsPraWorkbook, type HighWindsPraWorkbookDocument } from "./high-winds-pra-workbook.schema";
import { HighWindsPraWorkbooksService } from "./high-winds-pra-workbooks.service";

@Injectable()
export class HighWindsPraMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "W";

  constructor(
    @InjectModel(HighWindsPraWorkbook.name) private readonly workbookModel: Model<HighWindsPraWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly workbooksService: HighWindsPraWorkbooksService,
  ) {}

  onModuleInit(): void { this.registry.register(this); }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    await this.workbookModel.create({ workbookId, projectId, ownerUsername, mef: createBlankHighWindsPra(name, ownerUsername) });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    return doc ? { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef } : null;
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("High Winds PRA workbook not found");
    const parsed = HighWindsPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid High Winds PRA workbook payload: ${parsed.error.message}`);
    doc.mef = synchronizeHighWindsPraDerivedRegisters(parsed.data);
    await doc.save();
    return doc.mef;
  }

  validateForReview(mef: object): string[] {
    const parsed = HighWindsPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) return ["The High Winds PRA data does not conform to its MEF schema."];
    return reviewBlockingHighWindsPraDiagnostics(parsed.data).map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
  }

  exampleVariants(): WorkbookExampleVariant[] { return HIGH_WINDS_PRA_EXAMPLES.map((example) => ({ exampleId: example.id, label: example.label, workbookName: exampleWorkbookName(example.slug) })); }
  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> { await this.workbooksService.loadExample(workbookId, acting, exampleId); }
}
