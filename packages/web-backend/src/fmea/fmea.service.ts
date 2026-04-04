import crypto from "crypto";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { ModelCounter, ModelCounterDocument } from "../schemas/model-counter.schema";
import { Fmea, FmeaDocument } from "./schemas/fmea.schema";

@Injectable()
export class FmeaService {
  constructor(
    @InjectModel(Fmea.name)
    private readonly fmeaModel: mongoose.Model<FmeaDocument>,
    @InjectModel(ModelCounter.name)
    private readonly ModelCounterModel: mongoose.Model<ModelCounterDocument>,
  ) {}

  async getNextValue(name: string): Promise<number> {
    const record = await this.ModelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.ModelCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  async getValue(name: string): Promise<number> {
    const record = await this.ModelCounterModel.findById(name);
    return record.seq;
  }

  async createFmea(body): Promise<Fmea> {
    const newfmea = new this.fmeaModel({
      id: await this.getNextValue("FMEACounter"),
      systemsAnalysisId: body.systemsAnalysisId !== undefined ? Number(body.systemsAnalysisId) : undefined,
      title: body.title,
      description: body.description,
      columns: [],
      rows: [],
    });
    await newfmea.save();
    return newfmea;
  }

  async getFmeaBySaId(saId: number): Promise<Fmea[]> {
    return this.fmeaModel.find({ systemsAnalysisId: Number(saId) }, { _id: 0 }).lean();
  }

  async getFmeaById(id: number): Promise<Fmea | null> {
    return this.fmeaModel.findOne({ id: id }).lean();
  }

  async getNumberOfFmea(): Promise<number> {
    return this.fmeaModel.countDocuments();
  }

  async addColumn(fmeaId: number, body): Promise<Fmea | null> {
    const column = {
      id: body.name,
      name: body.name,
      type: body.type,
      dropdownOptions: [],
    };
    if (body.type === "dropdown") {
      column.dropdownOptions = body.dropdownOptions;
    }
    const fmea = await this.getFmeaById(fmeaId);
    let valueToStore = "";
    if (column.type === "dropdown") {
      valueToStore = String(column.dropdownOptions[0].number);
    }
    const rowLength = fmea.rows ? fmea.rows.length : 0;
    for (let i = 0; i < rowLength; i++) {
      fmea.rows[i].row_data[column.id] = valueToStore;
    }
    fmea.columns.push(column);

    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: fmea.columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  async addRow(fmeaId: number): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const row_data: Record<string, string> = {};
    for (let i = 0; i < fmea.columns.length; i++) {
      if (fmea.columns[i].type === "string") {
        row_data[fmea.columns[i].id] = "";
      } else if (fmea.columns[i].type === "dropdown") {
        row_data[fmea.columns[i].id] = String(fmea.columns[i].dropdownOptions[0].number);
      }
    }
    const uuid = crypto.randomUUID();
    const row = {
      id: uuid,
      row_data: row_data,
    };

    return this.fmeaModel.findOneAndUpdate({ id: fmeaId }, { $push: { rows: row } }, { new: true }).lean();
  }

  async updateCell(fmeaId: number, rowId: string, column: string, value: string): Promise<boolean> {
    const fmea = await this.getFmeaById(fmeaId);
    if (!fmea) return false;
    const columns = fmea.columns ?? [];
    const columnObject = columns.find((c) => c.id === column);
    const row = (fmea.rows ?? []).find((r) => r.id === rowId);
    if (!columnObject || !row) return false;
    if (columnObject.type === "dropdown") {
      const dropdownOptions = columnObject.dropdownOptions ?? [];
      const dropdownOption = dropdownOptions.find((opt) => opt.number === Number(value));
      if (!dropdownOption) {
        return false;
      }
    }
    row.row_data[column] = value;

    const updateResult = await this.fmeaModel.updateOne(
      { id: fmeaId, "rows.id": rowId },
      { $set: { "rows.$.row_data": row.row_data } },
    );
    return updateResult.modifiedCount > 0;
  }

  async updateDropdownOptions(
    fmeaId: number,
    column: string,
    dropdownOptions: { number: number; description: string }[],
  ): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    if (!fmea) return null;
    const columns = fmea.columns ?? [];
    const columnObject = columns.find((c) => c.id === column);
    if (!columnObject) return fmea;

    if (columnObject.type === "string") {
      return fmea;
    }
    columnObject.dropdownOptions = dropdownOptions;
    for (let i = 0; i < (fmea.rows ?? []).length; i++) {
      const storedValue = String(dropdownOptions[0].number);
      fmea.rows[i].row_data[column] = storedValue;
    }
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  async updateColumn(fmeaId: number, column: string, columnObject): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObjectToUpdate = columns.find((columnObject) => columnObject.id === column);
    columnObjectToUpdate.name = columnObject.name;
    columnObjectToUpdate.type = columnObject.type;
    columnObjectToUpdate.dropdownOptions = columnObject.dropdownOptions;
    for (let i = 0; i < fmea.rows.length; i++) {
      const previousValue = fmea.rows[i].row_data[column];
      delete fmea.rows[i].row_data[column];
      fmea.rows[i].row_data[columnObject.id] = previousValue as any;
    }
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  async deleteFmea(id: number): Promise<boolean | null> {
    const didDelete = await this.fmeaModel.deleteOne({ id: id });
    return didDelete.deletedCount > 0;
  }

  async deleteColumn(fmeaId: number, column: string): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    fmea.columns = fmea.columns.filter((columnObject) => columnObject.id !== column);
    for (let i = 0; i < fmea.rows.length; i++) {
      delete fmea.rows[i].row_data[column];
    }
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: fmea.columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  async deleteRow(fmeaId: number, rowId: string | number): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const rows = fmea.rows.filter((row) => row.id !== String(rowId));

    return this.fmeaModel.findOneAndUpdate({ id: fmeaId }, { $set: { rows: rows } }, { new: true }).lean();
  }

  async updateColumnName(fmeaId: number, column: string, newColumn: string): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find((columnObject) => columnObject.id === column);
    columnObject.name = newColumn;
    for (let i = 0; i < fmea.rows.length; i++) {
      const previousValue = fmea.rows[i].row_data[column];
      delete fmea.rows[i].row_data[column];
      fmea.rows[i].row_data[column] = previousValue;
    }
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  async updateColumnType(fmeaId: number, body): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find((columnObject) => columnObject.id === body.id);
    columnObject.name = body.name;
    columnObject.type = body.type;

    let valueToStore = "";
    columnObject.dropdownOptions = [];
    if (columnObject.type === "dropdown") {
      columnObject.dropdownOptions = body.dropdownOptions;
      valueToStore = String(columnObject.dropdownOptions[0].number);
    }

    for (let i = 0; i < fmea.rows.length; i++) {
      fmea.rows[i].row_data[columnObject.id] = valueToStore;
    }

    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: fmea.columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  async updateColumnDetails(fmeaId: number, prev_name: string, column_body: any): Promise<Fmea | null> {
    const fmea = await this.fmeaModel.findOne({ id: fmeaId }).lean();
    const columns = fmea.columns;
    let result;
    const column = columns.find((column) => column.id === prev_name);
    if (column_body.name !== column.name) {
      result = await this.updateColumnName(fmea.id, column.id, column_body.name);
    }
    if (column_body.type !== column.type) {
      result = await this.updateColumnType(fmea.id, column_body);
    }
    if (column_body.type === "dropdown" && column_body.dropdownOptions !== column.dropdownOptions) {
      result = await this.updateDropdownOptions(fmea.id, prev_name, column_body.dropdownOptions);
    }
    return result;
  }
}
