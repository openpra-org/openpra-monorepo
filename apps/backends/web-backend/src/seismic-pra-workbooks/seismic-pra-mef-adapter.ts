import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { SEISMIC_PRA_EXAMPLES, exampleWorkbookName } from "../example-workbooks/seeds";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { WorkbookElementRegistry, type WorkbookElementAdapter, type WorkbookExampleVariant } from "../workbooks/workbook-element-registry";
import { createBlankSeismicPra } from "./blank-seismic-pra";
import { SeismicPraWorkbook, type SeismicPraWorkbookDocument } from "./seismic-pra-workbook.schema";
import { SeismicPraWorkbooksService } from "./seismic-pra-workbooks.service";

@Injectable()
export class SeismicPraMefAdapter implements WorkbookElementAdapter, OnModuleInit {
  readonly elementCode = "S";

  constructor(
    @InjectModel(SeismicPraWorkbook.name) private readonly workbookModel: Model<SeismicPraWorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly workbooksService: SeismicPraWorkbooksService,
  ) {}

  onModuleInit(): void { this.registry.register(this); }

  async createBlank(workbookId: string, projectId: string, name: string, ownerUsername: string): Promise<void> {
    await this.workbookModel.create({ workbookId, projectId, ownerUsername, mef: createBlankSeismicPra(name, ownerUsername) });
  }

  async load(workbookId: string): Promise<{ projectId: string; ownerUsername: string; mef: unknown } | null> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    return doc ? { projectId: doc.projectId, ownerUsername: doc.ownerUsername, mef: doc.mef } : null;
  }

  async save(workbookId: string, mef: unknown): Promise<unknown> {
    const doc = await this.workbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new BadRequestException("Seismic PRA workbook not found");
    const parsed = SeismicPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid Seismic PRA workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return parsed.data;
  }

  exampleVariants(): WorkbookExampleVariant[] {
    return SEISMIC_PRA_EXAMPLES.map((example) => ({ exampleId: example.id, label: example.label, workbookName: exampleWorkbookName(example.slug) }));
  }

  async loadExample(workbookId: string, acting: { username: string }, exampleId: string): Promise<void> {
    await this.workbooksService.loadExample(workbookId, acting, exampleId);
  }
}
