import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { reviewBlockingHsaDiagnostics, synchronizeHsaDerivedRegisters } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis-validation";
import { HazardsScreeningAnalysisSchema } from "interfaces-mef-types/zod/hazards-screening/hazards-screening-analysis";
import { HSA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { createBlankHazardsScreeningAnalysis } from "./blank-hazards-screening-analysis";
import { HazardsScreeningAnalysisWorkbook, type HazardsScreeningAnalysisWorkbookDocument } from "./hazards-screening-analysis-workbook.schema";
import { HazardsScreeningAnalysisWorkbooksService } from "./hazards-screening-analysis-workbooks.service";

@Injectable()
export class HazardsScreeningAnalysisMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "HS";
  constructor(@InjectModel(HazardsScreeningAnalysisWorkbook.name) private readonly workbookModel: Model<HazardsScreeningAnalysisWorkbookDocument>, private readonly registry: WorkbookElementRegistry, private readonly workbooksService: HazardsScreeningAnalysisWorkbooksService) {}
  onModuleInit(): void { this.registry.register(this); }
  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> { await this.workbookModel.create({ workbookId, projectId, ownerUsername, mef: createBlankHazardsScreeningAnalysis(name, ownerUsername) }); }
  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> { const doc = await this.workbookModel.findOne({ workbookId }).exec(); return doc ? { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef } : null; }
  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec(); if (!doc) throw new BadRequestException("Hazards Screening Analysis workbook not found");
    const parsed = HazardsScreeningAnalysisSchema.safeParse(stripNulls(mef)); if (!parsed.success) throw new BadRequestException(`Invalid Hazards Screening Analysis workbook payload: ${parsed.error.message}`);
    doc.mef = synchronizeHsaDerivedRegisters(parsed.data); await doc.save(); return doc.mef;
  }
  validateForReview(mef: object): string[] { const parsed = HazardsScreeningAnalysisSchema.safeParse(stripNulls(mef)); if (!parsed.success) return ["The Hazards Screening Analysis data does not conform to its MEF schema."]; return reviewBlockingHsaDiagnostics(parsed.data).map((item) => `${item.code}: ${item.message}`); }
  exampleVariants(): WorkbookExampleVariant[] { return HSA_EXAMPLES.map((item) => ({ exampleId: item.id, label: item.label, workbookName: exampleWorkbookName(item.slug) })); }
  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> { await this.workbooksService.loadExample(workbookId, acting, exampleId); }
}
