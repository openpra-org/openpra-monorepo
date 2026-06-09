import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { SuccessCriteriaDevelopmentSchema } from "interfaces-mef-types/zod/sc/success-criteria-development";
import { WorkbookElementRegistry, type WorkbookElementAdapter } from "../workbooks/workbook-element-registry";
import { ScWorkbook, type ScWorkbookDocument } from "./sc-workbook.schema";
import { createBlankSc } from "./blank-sc";
import { stripNulls } from "../pos-workbooks/mef-normalize";

@Injectable()
export class ScMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "SC";

  constructor(
    @InjectModel(ScWorkbook.name) private readonly scWorkbookModel: Model<ScWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    const mef = createBlankSc(name, ownerUsername);
    await this.scWorkbookModel.create({ workbookId, projectId, ownerUsername, mef });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.scWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) return null;
    return { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef };
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.scWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("SC workbook not found");
    const parsed = SuccessCriteriaDevelopmentSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid SC workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }
}
