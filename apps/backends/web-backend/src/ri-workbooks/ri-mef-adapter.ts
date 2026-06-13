import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RiskIntegrationSchema } from "interfaces-mef-types/zod/ri/risk-integration";
import { WorkbookElementRegistry, type WorkbookElementAdapter } from "../workbooks/workbook-element-registry";
import { RiWorkbook, type RiWorkbookDocument } from "./ri-workbook.schema";
import { createBlankRi } from "./blank-ri";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class RiMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "RI";

  constructor(
    @InjectModel(RiWorkbook.name) private readonly riWorkbookModel: Model<RiWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankRi(name, ownerUsername);
    await this.riWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.riWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.riWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("RI workbook not found");
    const parsed = RiskIntegrationSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid RI workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }
}
