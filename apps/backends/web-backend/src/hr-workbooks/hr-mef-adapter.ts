import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HumanReliabilityAnalysisSchema } from "interfaces-mef-types/zod/hr/human-reliability-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter } from "../workbooks/workbook-element-registry";
import { HrWorkbook, type HrWorkbookDocument } from "./hr-workbook.schema";
import { createBlankHr } from "./blank-hr";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class HrMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "HRA";

  constructor(
    @InjectModel(HrWorkbook.name) private readonly hrWorkbookModel: Model<HrWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankHr(name, ownerUsername);
    await this.hrWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.hrWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.hrWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("HR workbook not found");
    const parsed = HumanReliabilityAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid HR workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }
}
