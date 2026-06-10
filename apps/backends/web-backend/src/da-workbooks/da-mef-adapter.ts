import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter } from "../workbooks/workbook-element-registry";
import { DaWorkbook, type DaWorkbookDocument } from "./da-workbook.schema";
import { createBlankDa } from "./blank-da";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class DaMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "DA";

  constructor(
    @InjectModel(DaWorkbook.name) private readonly daWorkbookModel: Model<DaWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankDa(name, ownerUsername);
    await this.daWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("DA workbook not found");
    const parsed = DataAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid DA workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }
}
