import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter } from "../workbooks/workbook-element-registry";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { createBlankRc } from "./blank-rc";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class RcMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "RC";

  constructor(
    @InjectModel(RcWorkbook.name) private readonly rcWorkbookModel: Model<RcWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankRc(name, ownerUsername);
    await this.rcWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("RC workbook not found");
    const parsed = RadiologicalConsequenceAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid RC workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }
}
