import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Connection, Model, Types } from "mongoose";
import { stringifyJson } from "interfaces-shared-types/json";
import { EsWorkbook, type EsWorkbookDocument } from "../es-workbooks/es-workbook.schema";
import { SyWorkbook, type SyWorkbookDocument } from "../sy-workbooks/sy-workbook.schema";
import { holdsNetworks, moveEsNetworks } from "./es-network-migration";
import { jsonRecordOf, recordField, textField, type JsonRecord } from "./uncertainty-migration-json";
import { BACKUP_COLLECTION } from "./uncertainty-migration.service";
import { createWorkbookRevisionFilter, readWorkbookRevision } from "./workbook-revision";

const ES_NETWORK_MIGRATION_ID = "es-networks-to-sy-2026-10";

interface StoredWorkbook {
  _id: Types.ObjectId;
  workbookId: string;
  projectId: string;
  revision?: number;
  mef?: object | null;
}

interface WorkbookRow {
  _id: Types.ObjectId;
  workbookId?: string;
}

function sentence(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error)).trim();
  return text.endsWith(".") ? text : `${text}.`;
}

function mefOf(record: StoredWorkbook): JsonRecord | undefined {
  return jsonRecordOf(stringifyJson(record.mef ?? null));
}

function linkedSy(mef: JsonRecord): string | undefined {
  const links = recordField(mef, "linkedWorkbooks");
  const id = links === undefined ? undefined : textField(links, "SY");
  return id === undefined || id.startsWith("example") ? undefined : id;
}

@Injectable()
export class EsNetworkMigrationService implements OnModuleInit {
  private readonly logger = new Logger(EsNetworkMigrationService.name);

  constructor(
    @InjectModel(EsWorkbook.name)
    private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(SyWorkbook.name)
    private readonly syWorkbookModel: Model<SyWorkbookDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const moved = await this.run();
      if (moved > 0) this.logger.log(`${moved} ES workbooks moved their dependency networks to the linked SY workbook.`);
    } catch (error) {
      this.logger.error(`The ES network move stopped. ${sentence(error)} The backend starts anyway.`);
    }
  }

  async run(): Promise<number> {
    const rows = await this.esWorkbookModel.find({}, { _id: 1, workbookId: 1 }).sort({ _id: 1 }).lean<WorkbookRow[]>().exec();
    let moved = 0;
    for (const row of rows) {
      try {
        if (await this.moveOne(row._id)) moved += 1;
      } catch (error) {
        this.logger.warn(`ES workbook ${row.workbookId ?? row._id.toHexString()} kept its dependency networks. ${sentence(error)}`);
      }
    }
    return moved;
  }

  private async moveOne(id: Types.ObjectId): Promise<boolean> {
    const es = await this.esWorkbookModel.findOne({ _id: id }).lean<StoredWorkbook>().exec();
    const esMef = es === null ? undefined : mefOf(es);
    if (es === null || esMef === undefined || !holdsNetworks(esMef)) return false;
    const syId = linkedSy(esMef);
    if (syId === undefined) {
      this.logger.warn(`ES workbook ${es.workbookId} kept its dependency networks. It links no SY workbook. Link one and restart the backend to move them.`);
      return false;
    }
    const sy = await this.syWorkbookModel.findOne({ workbookId: syId }).lean<StoredWorkbook>().exec();
    const syMef = sy === null ? undefined : mefOf(sy);
    if (sy === null || syMef === undefined) {
      this.logger.warn(`ES workbook ${es.workbookId} kept its dependency networks. Its SY workbook ${syId} was not found.`);
      return false;
    }
    const move = moveEsNetworks(esMef, es.workbookId, syMef, syId);
    await this.backUp<SyWorkbookDocument>(this.syWorkbookModel, sy);
    await this.backUp<EsWorkbookDocument>(this.esWorkbookModel, es);
    if (!(await this.write<SyWorkbookDocument>(this.syWorkbookModel, sy, move.sy))) {
      this.logger.warn(`ES workbook ${es.workbookId} kept its dependency networks. SY workbook ${syId} changed during the move. It moves at the next start.`);
      return false;
    }
    if (!(await this.write<EsWorkbookDocument>(this.esWorkbookModel, es, move.es))) {
      this.logger.warn(`ES workbook ${es.workbookId} changed during the move. Its networks are in SY workbook ${syId}, and the ES copy goes at the next start.`);
      return false;
    }
    for (const note of move.notes) this.logger.warn(`ES workbook ${es.workbookId}. ${note}`);
    return true;
  }

  private async backUp<T>(model: Model<T>, record: StoredWorkbook): Promise<void> {
    const original = await model.collection.findOne({ _id: record._id });
    if (original === null) return;
    await this.connection.collection(BACKUP_COLLECTION).insertOne({
      migration: ES_NETWORK_MIGRATION_ID,
      collection: model.collection.collectionName,
      workbookId: record.workbookId,
      projectId: record.projectId,
      backedUpAt: new Date(),
      document: original,
    });
  }

  private async write<T>(model: Model<T>, record: StoredWorkbook, mef: JsonRecord): Promise<boolean> {
    const revision = readWorkbookRevision(record);
    const update = await model.updateOne(createWorkbookRevisionFilter(record.workbookId, revision), { $set: { mef, revision: revision + 1 } }).exec();
    return update.matchedCount === 1;
  }
}
