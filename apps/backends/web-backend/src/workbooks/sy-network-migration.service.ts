import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Connection, Model, Types } from "mongoose";
import { EsWorkbook, type EsWorkbookDocument } from "../es-workbooks/es-workbook.schema";
import { EsqWorkbook, type EsqWorkbookDocument } from "../esq-workbooks/esq-workbook.schema";
import { SyWorkbook, type SyWorkbookDocument } from "../sy-workbooks/sy-workbook.schema";
import { EsNetworkMigrationService, mefOf, sentence, type StoredWorkbook, type WorkbookRow } from "./es-network-migration.service";
import {
  carriedNodeLinks,
  convertEsqNetworkLinks,
  esqTargets,
  heldSyNetworks,
  receiveSyNetworks,
  stripEsNetworks,
  sySourceOf,
  withoutNetworks,
  withoutNetworkNodes,
  type EsqPlacement,
  type NetworkConversion,
} from "./sy-network-migration";
import { jsonTextOf, type JsonRecord } from "./uncertainty-migration-json";
import { BACKUP_COLLECTION, previousRecord } from "./uncertainty-migration.service";
import { createWorkbookRevisionFilter, readWorkbookRevision } from "./workbook-revision";

const SY_NETWORK_MIGRATION_ID = "sy-networks-to-esq-2026-11";

interface StoredParts extends StoredWorkbook {
  previousMefJson?: string | null;
}

interface PartChanges {
  mef?: JsonRecord;
  previousMefJson?: string;
}

type PartConversion = (mef: JsonRecord, prior: boolean, workbookId: string) => NetworkConversion;

function priorOf(record: StoredParts): JsonRecord | undefined {
  const text = record.previousMefJson;
  return typeof text === "string" && text.length > 0 ? previousRecord(text) : undefined;
}

@Injectable()
export class SyNetworkMigrationService implements OnModuleInit {
  private readonly logger = new Logger(SyNetworkMigrationService.name);

  constructor(
    @InjectModel(SyWorkbook.name)
    private readonly syWorkbookModel: Model<SyWorkbookDocument>,
    @InjectModel(EsqWorkbook.name)
    private readonly esqWorkbookModel: Model<EsqWorkbookDocument>,
    @InjectModel(EsWorkbook.name)
    private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly esNetworkMigration: EsNetworkMigrationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.esNetworkMigration.start();
    try {
      const changed = await this.run();
      if (changed > 0) this.logger.log(`${changed} workbooks were updated so that dependency networks live in ESQ only.`);
    } catch (error) {
      this.logger.error(`The dependency network move to ESQ stopped. ${sentence(error)} The backend starts anyway.`);
    }
  }

  async run(): Promise<number> {
    const carried = new Set<string>();
    const moved = await this.moveAll(carried);
    const converted = await this.convertAll<EsqWorkbookDocument>(this.esqWorkbookModel, "ESQ", (mef, prior, workbookId) => (prior ? convertEsqNetworkLinks(mef, workbookId) : this.converted(mef, workbookId, carried)));
    const stripped = await this.convertAll<EsWorkbookDocument>(this.esWorkbookModel, "ES", (mef, prior) => (prior ? { mef: withoutNetworkNodes(mef), notes: [] } : stripEsNetworks(mef, carried)));
    return moved + converted + stripped;
  }

  private converted(esq: JsonRecord, esqId: string, carried: Set<string>): NetworkConversion {
    const conversion = convertEsqNetworkLinks(esq, esqId);
    for (const key of [...carriedNodeLinks(esq), ...carriedNodeLinks(conversion.mef)]) carried.add(key);
    return conversion;
  }

  private rows<T>(model: Model<T>): Promise<WorkbookRow[]> {
    return model.find({}, { _id: 1, workbookId: 1 }).sort({ _id: 1 }).lean<WorkbookRow[]>().exec();
  }

  private read<T>(model: Model<T>, id: Types.ObjectId): Promise<StoredParts | null> {
    return model.findOne({ _id: id }).lean<StoredParts>().exec();
  }

  private async placements(): Promise<EsqPlacement[]> {
    const placements: EsqPlacement[] = [];
    for (const row of await this.rows<EsqWorkbookDocument>(this.esqWorkbookModel)) {
      const esq = await this.read<EsqWorkbookDocument>(this.esqWorkbookModel, row._id);
      const mef = esq === null ? undefined : mefOf(esq);
      if (esq === null || mef === undefined) continue;
      const sySource = sySourceOf(mef);
      placements.push({ workbookId: esq.workbookId, projectId: esq.projectId, ...(sySource === undefined ? {} : { sySource }) });
    }
    return placements;
  }

  private async moveAll(carried: Set<string>): Promise<number> {
    let placements: EsqPlacement[] | undefined;
    let moved = 0;
    for (const row of await this.rows<SyWorkbookDocument>(this.syWorkbookModel)) {
      try {
        const sy = await this.read<SyWorkbookDocument>(this.syWorkbookModel, row._id);
        const mef = sy === null ? undefined : mefOf(sy);
        if (sy === null || mef === undefined) continue;
        const prior = priorOf(sy);
        const held = heldSyNetworks(mef, prior);
        if (held === undefined) continue;
        placements ??= await this.placements();
        if (await this.moveOne(sy, mef, prior, held, esqTargets(sy.workbookId, sy.projectId, placements), carried)) moved += 1;
      } catch (error) {
        this.logger.warn(`SY workbook ${row.workbookId ?? row._id.toHexString()} kept its dependency networks. ${sentence(error)}`);
      }
    }
    return moved;
  }

  private async moveOne(sy: StoredParts, mef: JsonRecord, prior: JsonRecord | undefined, held: JsonRecord, targets: readonly string[], carried: Set<string>): Promise<boolean> {
    for (const esqId of targets) {
      const refusal = await this.receive(esqId, held, sy.workbookId, carried);
      if (refusal !== undefined) {
        this.logger.warn(`SY workbook ${sy.workbookId} kept its dependency networks. ESQ workbook ${esqId} ${refusal} They move at the next start.`);
        return false;
      }
    }
    const emptied = withoutNetworks(mef);
    const restored = prior === undefined ? undefined : withoutNetworks(prior);
    await this.backUp<SyWorkbookDocument>(this.syWorkbookModel, sy);
    if (!(await this.write<SyWorkbookDocument>(this.syWorkbookModel, sy, this.changes(mef, emptied, prior, restored)))) {
      this.logger.warn(`SY workbook ${sy.workbookId} changed during the move. Its dependency networks are in ESQ, and the SY copy goes at the next start.`);
      return false;
    }
    if (targets.length === 0) this.logger.warn(`SY workbook ${sy.workbookId} had dependency networks and its project has no ESQ workbook to hold them. They were removed. The backup keeps them.`);
    return true;
  }

  private async receive(esqId: string, held: JsonRecord, syId: string, carried: Set<string>): Promise<string | undefined> {
    const esq = await this.esqWorkbookModel.findOne({ workbookId: esqId }).lean<StoredParts>().exec();
    const mef = esq === null ? undefined : mefOf(esq);
    if (esq === null || mef === undefined) return "could not be read.";
    const prior = priorOf(esq);
    const current = this.converted(receiveSyNetworks(mef, esqId, held, syId), esqId, carried);
    const restored = prior === undefined ? undefined : convertEsqNetworkLinks(receiveSyNetworks(prior, esqId, held, syId), esqId);
    const changes = this.changes(mef, current.mef, prior, restored?.mef);
    if (changes.mef !== undefined || changes.previousMefJson !== undefined) {
      await this.backUp<EsqWorkbookDocument>(this.esqWorkbookModel, esq);
      if (!(await this.write<EsqWorkbookDocument>(this.esqWorkbookModel, esq, changes))) return "changed during the move.";
    }
    this.report("ESQ", esqId, current, restored);
    return undefined;
  }

  private changes(mef: JsonRecord, current: JsonRecord, prior: JsonRecord | undefined, restored: JsonRecord | undefined): PartChanges {
    return {
      ...(current === mef ? {} : { mef: current }),
      ...(restored === undefined || restored === prior ? {} : { previousMefJson: jsonTextOf(restored) }),
    };
  }

  private report(element: string, workbookId: string, current: NetworkConversion, restored: NetworkConversion | undefined): void {
    for (const note of current.notes) this.logger.warn(`${element} workbook ${workbookId}. ${note}`);
    for (const note of restored?.notes ?? []) this.logger.warn(`${element} workbook ${workbookId}, prior contents. ${note}`);
  }

  private async convertAll<T>(model: Model<T>, element: string, convert: PartConversion): Promise<number> {
    let changed = 0;
    for (const row of await this.rows(model)) {
      try {
        if (await this.convertOne(model, row._id, element, convert)) changed += 1;
      } catch (error) {
        this.logger.warn(`${element} workbook ${row.workbookId ?? row._id.toHexString()} was left as stored. ${sentence(error)}`);
      }
    }
    return changed;
  }

  private async convertOne<T>(model: Model<T>, id: Types.ObjectId, element: string, convert: PartConversion): Promise<boolean> {
    const record = await this.read(model, id);
    const mef = record === null ? undefined : mefOf(record);
    if (record === null || mef === undefined) return false;
    const current = convert(mef, false, record.workbookId);
    const prior = priorOf(record);
    const restored = prior === undefined ? undefined : convert(prior, true, record.workbookId);
    const changes = this.changes(mef, current.mef, prior, restored?.mef);
    if (changes.mef === undefined && changes.previousMefJson === undefined) return false;
    await this.backUp(model, record);
    if (!(await this.write(model, record, changes))) {
      this.logger.warn(`${element} workbook ${record.workbookId} changed during the conversion. It converts at the next start.`);
      return false;
    }
    this.report(element, record.workbookId, current, restored);
    return true;
  }

  private async backUp<T>(model: Model<T>, record: StoredParts): Promise<void> {
    const original = await model.collection.findOne({ _id: record._id });
    if (original === null) return;
    await this.connection.collection(BACKUP_COLLECTION).insertOne({
      migration: SY_NETWORK_MIGRATION_ID,
      collection: model.collection.collectionName,
      workbookId: record.workbookId,
      projectId: record.projectId,
      backedUpAt: new Date(),
      document: original,
    });
  }

  private async write<T>(model: Model<T>, record: StoredParts, changes: PartChanges): Promise<boolean> {
    const revision = readWorkbookRevision(record);
    const update = await model.updateOne(createWorkbookRevisionFilter(record.workbookId, revision), { $set: { ...changes, revision: revision + 1 } }).exec();
    return update.matchedCount === 1;
  }
}

export { SY_NETWORK_MIGRATION_ID };
