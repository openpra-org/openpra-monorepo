import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PlantOperatingStatesAnalysisSchema } from "interfaces-mef-types/zod/pos/plant-operating-state-analysis";
import { WorkbookElementRegistry, type WorkbookElementAdapter } from "../workbooks/workbook-element-registry";
import { PosWorkbook, type PosWorkbookDocument } from "./pos-workbook.schema";
import { createBlankPos } from "./blank-pos";
import { stripNulls } from "./mef-normalize";

@Injectable()
export class PosMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "POS";

  constructor(
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankPos(name, ownerUsername);
    await this.posWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("POS workbook not found");
    const parsed = PlantOperatingStatesAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid POS workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }
}
