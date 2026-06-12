import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ExampleWorkbook, type ExampleWorkbookDocument } from "./example-workbook.schema";
import { SEEDS, POS_GENERIC_1_SLUG, IE_GENERIC_1_SLUG, ES_GENERIC_1_SLUG, SC_GENERIC_1_SLUG, SY_GENERIC_1_SLUG, HR_GENERIC_1_SLUG, DA_GENERIC_1_SLUG, ESQ_GENERIC_1_SLUG, MS_GENERIC_1_SLUG, RC_GENERIC_1_SLUG, CC_GENERIC_1_SLUG } from "./seeds";

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

  async getPosBundle(): Promise<PosExampleBundle> {
    const pos = await this.findBySlug(POS_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      pos,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getIeBundle(): Promise<IeExampleBundle> {
    const ie = await this.findBySlug(IE_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      ie,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getEsBundle(): Promise<EsExampleBundle> {
    const es = await this.findBySlug(ES_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      es,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getScBundle(): Promise<ScExampleBundle> {
    const sc = await this.findBySlug(SC_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      sc,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getSyBundle(): Promise<SyExampleBundle> {
    const sy = await this.findBySlug(SY_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      sy,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getHrBundle(): Promise<HrExampleBundle> {
    const hr = await this.findBySlug(HR_GENERIC_1_SLUG);
    const configurationControl = await this.findBySlug(CC_GENERIC_1_SLUG);
    const nmDocs = await this.exampleModel.find({ kind: "NEWLY_DEVELOPED_METHOD" }).sort({ slug: 1 }).exec();
    return {
      hr,
      configurationControl,
      newlyDevelopedMethods: nmDocs.map(toResponse),
    };
  }

  async getDaBundle(): Promise<DaExampleBundle> {
    const da = await this.findBySlug(DA_GENERIC_1_SLUG);
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
}
