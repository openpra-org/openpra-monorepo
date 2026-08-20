import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { reviewBlockingInternalFloodPraDiagnostics, synchronizeInternalFloodPraDerivedRegisters } from "interfaces-mef-types/internal-flood/internal-flood-pra-validation";
import { InternalFloodPRASchema } from "interfaces-mef-types/zod/internal-flood/internal-flood-pra";
import { INTERNAL_FLOOD_PRA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { createBlankInternalFloodPra } from "./blank-internal-flood-pra";
import { InternalFloodPraWorkbook, type InternalFloodPraWorkbookDocument } from "./internal-flood-pra-workbook.schema";
import { InternalFloodPraWorkbooksService } from "./internal-flood-pra-workbooks.service";

@Injectable()
export class InternalFloodPraMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "FL";
  constructor(@InjectModel(InternalFloodPraWorkbook.name) private readonly workbookModel: Model<InternalFloodPraWorkbookDocument>, private readonly registry: WorkbookElementRegistry, private readonly workbooksService: InternalFloodPraWorkbooksService) {}
  onModuleInit(): void { this.registry.register(this); }
  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> { await this.workbookModel.create({ workbookId, projectId, ownerUsername, mef: createBlankInternalFloodPra(name, ownerUsername) }); }
  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> { const doc = await this.workbookModel.findOne({ workbookId }).exec(); return doc ? { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef } : null; }
  async save(workbookId: string, mef: unknown): Promise<unknown> { const doc = await this.workbookModel.findOne({ workbookId }).exec(); if (!doc) throw new BadRequestException("Internal Flood PRA workbook not found"); const parsed = InternalFloodPRASchema.safeParse(stripNulls(mef)); if (!parsed.success) throw new BadRequestException(`Invalid Internal Flood PRA workbook payload: ${parsed.error.message}`); doc.mef = synchronizeInternalFloodPraDerivedRegisters(parsed.data); await doc.save(); return doc.mef; }
  validateForReview(mef: object): string[] { const parsed = InternalFloodPRASchema.safeParse(stripNulls(mef)); if (!parsed.success) return ["The Internal Flood PRA data does not conform to its MEF schema."]; return reviewBlockingInternalFloodPraDiagnostics(parsed.data).map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`); }
  exampleVariants(): WorkbookExampleVariant[] { return INTERNAL_FLOOD_PRA_EXAMPLES.map((example) => ({ exampleId: example.id, label: example.label, workbookName: exampleWorkbookName(example.slug) })); }
  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> { await this.workbooksService.loadExample(workbookId, acting, exampleId); }
}
