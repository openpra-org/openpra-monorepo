import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { MechanisticSourceTermAnalysisSchema } from "interfaces-mef-types/zod/ms/mechanistic-source-term-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter } from "../workbooks/workbook-element-registry";
import { MsWorkbook, type MsWorkbookDocument } from "./ms-workbook.schema";
import { createBlankMs } from "./blank-ms";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class MsMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "MS";

  constructor(
    @InjectModel(MsWorkbook.name) private readonly msWorkbookModel: Model<MsWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankMs(name, ownerUsername);
    await this.msWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.msWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.msWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("MS workbook not found");
    const parsed = MechanisticSourceTermAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid MS workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }
}
