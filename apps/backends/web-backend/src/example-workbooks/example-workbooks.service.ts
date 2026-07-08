import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ExampleWorkbook, type ExampleWorkbookDocument } from "./example-workbook.schema";
import { SEEDS, POS_EXAMPLES, IE_EXAMPLES, ES_EXAMPLES, SC_EXAMPLES, SY_EXAMPLES, HR_EXAMPLES, DA_EXAMPLES, ES_GENERIC_1_SLUG, SC_GENERIC_1_SLUG, SY_GENERIC_1_SLUG, HR_GENERIC_1_SLUG, ESQ_GENERIC_1_SLUG, MS_GENERIC_1_SLUG, RC_GENERIC_1_SLUG, RI_GENERIC_1_SLUG, CC_GENERIC_1_SLUG } from "./seeds";

export interface ExampleWorkbookResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

export interface PosExampleBundle {
  pos: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface PosExampleOption {
  id: string;
  label: string;
}

export interface IeExampleOption {
  id: string;
  label: string;
}

export interface IeExampleBundle {
  ie: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface EsExampleBundle {
  es: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface ScExampleBundle {
  sc: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface SyExampleBundle {
  sy: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface HrExampleBundle {
  hr: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface DaExampleBundle {
  da: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface EsqExampleBundle {
  esq: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface MsExampleBundle {
  ms: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface RcExampleBundle {
  rc: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

export interface RiExampleBundle {
  ri: ExampleWorkbookResponse;
  configurationControl: ExampleWorkbookResponse;
  newlyDevelopedMethods: ExampleWorkbookResponse[];
}

function toResponse(doc: ExampleWorkbookDocument): ExampleWorkbookResponse {
  return {
    slug: doc.slug,
    kind: doc.kind,
    mef: doc.mef,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Injectable()
export class ExampleWorkbooksService implements OnModuleInit {
  private readonly logger = new Logger(ExampleWorkbooksService.name);

  constructor(
    @InjectModel(ExampleWorkbook.name) private readonly exampleModel: Model<ExampleWorkbookDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    let upserted = 0;
    for (const seed of SEEDS) {
      await this.exampleModel.updateOne(
        { slug: seed.slug },
        { $set: { slug: seed.slug, kind: seed.kind, mef: seed.mef } },
        { upsert: true },
      );
      upserted += 1;
    }
    this.logger.log(`Seeded ${String(upserted)} example workbook${upserted === 1 ? "" : "s"}`);
  }

  async findBySlug(slug: string): Promise<ExampleWorkbookResponse> {
    const doc = await this.exampleModel.findOne({ slug }).exec();
    if (!doc) throw new NotFoundException(`Example workbook "${slug}" not found`);
    return toResponse(doc);
  }

  getPosExamples(): PosExampleOption[] {
    return POS_EXAMPLES.map((e) => ({ id: e.id, label: e.label }));
  }

  async getPosBundle(exampleId?: string): Promise<PosExampleBundle> {
    const entry = POS_EXAMPLES.find((e) => e.id === exampleId) ?? POS_EXAMPLES[0];
    const pos = await this.findBySlug(entry.slug);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      pos,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  getIeExamples(): IeExampleOption[] {
    return IE_EXAMPLES.map((e) => ({ id: e.id, label: e.label }));
  }

  async getIeBundle(exampleId?: string): Promise<IeExampleBundle> {
    const entry = IE_EXAMPLES.find((e) => e.id === exampleId) ?? IE_EXAMPLES[0];
    const ie = await this.findBySlug(entry.slug);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      ie,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  getEsExamples(): IeExampleOption[] {
    return ES_EXAMPLES.map((e) => ({ id: e.id, label: e.label }));
  }

  async getEsBundle(exampleId?: string): Promise<EsExampleBundle> {
    const entry = ES_EXAMPLES.find((e) => e.id === exampleId) ?? ES_EXAMPLES[0];
    const es = await this.findBySlug(entry.slug);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      es,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  getScExamples(): IeExampleOption[] {
    return SC_EXAMPLES.map((e) => ({ id: e.id, label: e.label }));
  }

  async getScBundle(exampleId?: string): Promise<ScExampleBundle> {
    const entry = SC_EXAMPLES.find((e) => e.id === exampleId) ?? SC_EXAMPLES[0];
    const sc = await this.findBySlug(entry.slug);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      sc,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  getSyExamples(): IeExampleOption[] {
    return SY_EXAMPLES.map((e) => ({ id: e.id, label: e.label }));
  }

  async getSyBundle(exampleId?: string): Promise<SyExampleBundle> {
    const entry = SY_EXAMPLES.find((e) => e.id === exampleId) ?? SY_EXAMPLES[0];
    const sy = await this.findBySlug(entry.slug);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      sy,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  getHrExamples(): IeExampleOption[] {
    return HR_EXAMPLES.map((e) => ({ id: e.id, label: e.label }));
  }

  async getHrBundle(exampleId?: string): Promise<HrExampleBundle> {
    const entry = HR_EXAMPLES.find((e) => e.id === exampleId) ?? HR_EXAMPLES[0];
    const hr = await this.findBySlug(entry.slug);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      hr,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  getDaExamples(): IeExampleOption[] {
    return DA_EXAMPLES.map((e) => ({ id: e.id, label: e.label }));
  }

  async getDaBundle(exampleId?: string): Promise<DaExampleBundle> {
    const entry = DA_EXAMPLES.find((e) => e.id === exampleId) ?? DA_EXAMPLES[0];
    const da = await this.findBySlug(entry.slug);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      da,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getEsqBundle(): Promise<EsqExampleBundle> {
    const esq = await this.findBySlug(ESQ_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      esq,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getMsBundle(): Promise<MsExampleBundle> {
    const ms = await this.findBySlug(MS_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      ms,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getRcBundle(): Promise<RcExampleBundle> {
    const rc = await this.findBySlug(RC_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      rc,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getRiBundle(): Promise<RiExampleBundle> {
    const ri = await this.findBySlug(RI_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      ri,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }
}
