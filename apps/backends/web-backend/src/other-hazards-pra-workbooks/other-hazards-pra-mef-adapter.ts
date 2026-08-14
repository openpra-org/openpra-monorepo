import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { reviewBlockingOtherHazardsPraDiagnostics, synchronizeOtherHazardsPraDerivedRegisters } from "interfaces-mef-types/other-hazards/other-hazards-pra-validation";
import { OtherHazardsPRASchema } from "interfaces-mef-types/zod/other-hazards/other-hazards-pra";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { OTHER_HAZARDS_PRA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { createBlankOtherHazardsPra } from "./blank-other-hazards-pra";
import { OtherHazardsPraWorkbook, type OtherHazardsPraWorkbookDocument } from "./other-hazards-pra-workbook.schema";
import { OtherHazardsPraWorkbooksService } from "./other-hazards-pra-workbooks.service";

@Injectable()
export class OtherHazardsPraMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "O";

  constructor(
    @InjectModel(OtherHazardsPraWorkbook.name) private readonly workbookModel: Model<OtherHazardsPraWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly workbooksService: OtherHazardsPraWorkbooksService,
  ) {}

  onModuleInit(): void { this.registry.register(this); }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    await this.workbookModel.create({ workbookId, projectId, ownerUsername, mef: createBlankOtherHazardsPra(name, ownerUsername) });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    return doc ? { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef } : null;
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("Other Hazards PRA workbook not found");
    const parsed = OtherHazardsPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid Other Hazards PRA workbook payload: ${parsed.error.message}`);
    doc.mef = synchronizeOtherHazardsPraDerivedRegisters(parsed.data);
    await doc.save();
    return doc.mef;
  }

  validateForReview(mef: object): string[] {
    const parsed = OtherHazardsPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) return ["The Other Hazards PRA data does not conform to its MEF schema."];
    return reviewBlockingOtherHazardsPraDiagnostics(parsed.data).map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
  }

  exampleVariants(): WorkbookExampleVariant[] { return OTHER_HAZARDS_PRA_EXAMPLES.map((example) => ({ exampleId: example.id, label: example.label, workbookName: exampleWorkbookName(example.slug) })); }
  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> { await this.workbooksService.loadExample(workbookId, acting, exampleId); }
}
