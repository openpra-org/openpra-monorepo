import crypto from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import validator from "validator";
import { ModelCounter, ModelCounterDocument } from "../schemas/model-counter.schema";
import { Fmea, FmeaDocument } from "./schemas/fmea.schema";
import isUUID = validator.isUUID;
@Injectable()
export class FmeaService {
  constructor(
    @InjectModel(Fmea.name)
    private readonly fmeaModel: mongoose.Model<FmeaDocument>,
    @InjectModel(ModelCounter.name)
    private readonly ModelCounterModel: mongoose.Model<ModelCounterDocument>,
  ) {}

  /**
   * this was copied from elsewhere, its to create a counter
   * @param {string} name Name of the counter
   * @description
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no model exists, the serial ID starts from 1.
   * @returns {number} ID number
   */
  async getNextValue(name: string) {
    const record = await this.ModelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.ModelCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  /**
   * this was copied from elsewhere, its to create a counter
   * @param {string} name Name of the counter
   * @description
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
   * @returns {number} ID number
   */
  async getValue(name: string): Promise<number> {
    const record = await this.ModelCounterModel.findById(name);
    return record.seq;
  }

  /**
   *
   * @param body containing title and description
   * @returns the FMEA object
   */
  async createFmea(body): Promise<Fmea> {
    //create a new fmea using the body
    const newfmea = new this.fmeaModel({
      id: await this.getNextValue("FMEACounter"),
      title: body.title,
      description: body.description,
      columns: [],
      rows: [],
    });
    //save the fmea to the database
  await newfmea.save();
    return newfmea;
  }

  /**
   *
   * @param id the unique ID for each FMEA
   * @returns the FMEA found
   */
  async getFmeaById(id: number): Promise<Fmea | null> {
    return this.fmeaModel.findOne({ id: id }).lean();
  }

  /**
   *
   * @returns Number of FMEAs in Database
   */
  async getNumberOfFmea(): Promise<number> {
    return this.fmeaModel.countDocuments();
  }

  /**
   *
   * @param {number} fmeaId for which new column needs to be added
   * @param body containing new column name,type and dropdownoptions
   * @description
   * Adds a column to the FMEA. If type of column is string then dropdownoptions is empty,
   *                            If type of column is dropdown then populated with Array containing options
   * @returns the updated FMEA
   */
  async addColumn(fmeaId: number, body): Promise<Fmea | null> {
    // Use the provided name as a stable column identifier to align with tests
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
    //update the rows with the new column
    let valueToStore = "";
    if (column.type === "dropdown") {
      valueToStore = String(column.dropdownOptions[0].number);
    }
    const rowLength = fmea.rows ? fmea.rows.length : 0;
    for (let i = 0; i < rowLength; i++) {
      //add key value pair to row_data
      fmea.rows[i].row_data[column.id] = valueToStore;
    }
    fmea.columns.push(column);

    //update the columns and rows in the database
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: fmea.columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  //function to add a new row
  /**
   * @param {number} fmeaId the ID of the FMEA to retrieve
   * @description
   * Adds a new row to the FMEA
   * For columns of type dropdown the value is initialized as empty string and
   * For columns of type dropdown the value is initialized as the first option
   * @returns the FMEA with the added row
   */
  async addRow(fmeaId: number): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const row_data: Record<string, string> = {};
    //loop over column of the fmea
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

  /**
   *
   * @param {number} fmeaId the ID of the FMEA to be updated
   * @param {number} rowId the ID of the row which is being updated
   * @param {string} column the column which is to be updated in the given row
   * @param {string} value the new value to be stored at the given row and column
   * @description
   * If column is of type dropdown then value is only updated if found in dropdownOptions
   * @returns True if cell is updated else false
   */
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

    // update the row_data for the given row in the database
    const updateResult = await this.fmeaModel.updateOne(
      { id: fmeaId, "rows.id": rowId },
      { $set: { "rows.$.row_data": row.row_data } },
    );
    return updateResult.modifiedCount > 0;
  }

  /**
   * @param {number} fmeaId the FMEA for which dropdown options need to be updated
   * @param {String}column for which dropdownoptions need to be updated
   * @param {Array}dropdownOptions updated array containing dropdown options
   * @description
   * if column type is string then do not update options
   * @returns the updated FMEA if updated else returns the unupdated FMEA
   */
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

    //do not update dropdown if column is of type string
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

  /**
   * @param {number} fmeaId the FMEA ID
   * @param {string} column the column to be updated
   * @param columnObject the column object containing name, type and dropdownoptions
   * @returns updated FMEA object
   */
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
    //update the column informations and rows in the database
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  /**
   *
   * @param id the FMEA ID
   * @returns True if FMEA is deleted else false
   */
  async deleteFmea(id: number): Promise<boolean | null> {
    const didDelete = await this.fmeaModel.deleteOne({ id: id });
    return didDelete.deletedCount > 0;
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @param column the column to be deleted
   * @returns updated FMEA object
   */
  async deleteColumn(fmeaId: number, column: string): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
  fmea.columns = fmea.columns.filter((columnObject) => columnObject.id !== column);
    for (let i = 0; i < fmea.rows.length; i++) {
      //delete key
      delete fmea.rows[i].row_data[column];
    }
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: fmea.columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @param rowId the row ID to be deleted
   * @returns updated FMEA object
   */
  async deleteRow(fmeaId: number, rowId: string | number): Promise<Fmea | null> {
    //get fmea object
  const fmea = await this.getFmeaById(fmeaId);
  //remove the row from the rows array
  const rows = fmea.rows.filter((row) => row.id !== String(rowId));

    //update the rows in the database
    return this.fmeaModel.findOneAndUpdate({ id: fmeaId }, { $set: { rows: rows } }, { new: true }).lean();
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @param column the column to be updated
   * @param newColumn the new column name
   * @returns updated FMEA object
   */
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
    //update the column informations and rows in the database
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @param body old column name and new column, dropdown options and type
   * @returns
   */
  async updateColumnType(fmeaId: number, body): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find((columnObject) => columnObject.id === body.id);
    console.log(body);
    // update the column name and type
    console.log(columnObject, "ddd");
    columnObject.name = body.name;
    columnObject.type = body.type;

    //update the rows with the new column
    let valueToStore = "";
    columnObject.dropdownOptions = [];
    if (columnObject.type === "dropdown") {
      columnObject.dropdownOptions = body.dropdownOptions;
      valueToStore = String(columnObject.dropdownOptions[0].number);
    }

    //make only a single update to the database
    for (let i = 0; i < fmea.rows.length; i++) {
      //add key value pair to row_data
      fmea.rows[i].row_data[columnObject.id] = valueToStore;
    }

    //update the columns and rows in the database
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: fmea.columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  /**
   *
   * @param prev_name name of column previously stored
   * @param column_body updated details of the column
   * @returns updated FMEA object
   */
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
      result = await this.updateDropdownOptions(fmea.id, column_body.id, column_body.dropdownOptions);
    }
    return result;
  }
}
