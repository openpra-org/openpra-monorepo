import crypto from "crypto";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { ModelCounter, ModelCounterDocument } from "../schemas/model-counter.schema";
import { Fmea, FmeaDocument } from "./schemas/fmea.schema";
/**
 * Service layer for FMEA business logic and persistence.
 * Supports CRUD operations on FMEA columns, rows, and cells.
 * @public
 */
@Injectable()
export class FmeaService {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
  /**
   * @param fmeaModel - Mongoose model for FMEA documents.
   * @param ModelCounterModel - Mongoose model for sequence counters.
   */
  constructor(
    @InjectModel(Fmea.name)
    private readonly fmeaModel: mongoose.Model<FmeaDocument>,
    @InjectModel(ModelCounter.name)
    private readonly ModelCounterModel: mongoose.Model<ModelCounterDocument>,
  ) {}

  /**
   * Create or increment a named counter.
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no model exists, the serial ID starts from 1.
   *
   * @param name - Name of the counter
   * @returns ID number
   */
  async getNextValue(name: string): Promise<number> {
    const record = await this.ModelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.ModelCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  /**
   * Read the current value of a named counter.
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
   *
   * @param name - Name of the counter
   * @returns ID number
   */
  async getValue(name: string): Promise<number> {
    const record = await this.ModelCounterModel.findById(name);
    return record.seq;
  }

  /**
   * Create a new FMEA.
   *
   * @param body - Contains title and description
   * @returns The created FMEA object
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
   * Get an FMEA by ID.
   *
   * @param id - The unique ID for the FMEA
   * @returns The FMEA found
   */
  async getFmeaById(id: number): Promise<Fmea | null> {
    return this.fmeaModel.findOne({ id: id }).lean();
  }

  /**
   * Get the number of FMEAs in the database.
   *
   * @returns Number of FMEAs in the database
   */
  async getNumberOfFmea(): Promise<number> {
    return this.fmeaModel.countDocuments();
  }

  /**
   * Add a column to the FMEA.
   * If the column type is "string" then dropdown options are empty; if it is "dropdown" then options are populated.
   *
   * @param fmeaId - FMEA ID to add the column to
   * @param body - Contains new column name, type, and dropdown options
   * @returns The updated FMEA
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

  // function to add a new row
  /**
   * Add a new row to the FMEA.
   * For columns of type string the value is initialized as empty string, and for dropdown columns it is set to the first option.
   *
   * @param fmeaId - The ID of the FMEA to update
   * @returns The FMEA with the added row
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
   * Update a cell value in a row.
   * If the column is of type dropdown then the value is updated only if found in dropdown options.
   *
   * @param fmeaId - The ID of the FMEA to be updated
   * @param rowId - The ID of the row being updated
   * @param column - The column to update
   * @param value - The new value to be stored at the given row and column
   * @returns True if the cell is updated; otherwise false
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
   * Update dropdown options for a column.
   * If the column type is string then options are not updated.
   *
   * @param fmeaId - FMEA ID
   * @param column - Column whose options should be updated
   * @param dropdownOptions - Updated array of dropdown options
   * @returns The updated FMEA if changed; otherwise the original FMEA
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
   * Update a column's metadata.
   *
   * @param fmeaId - The FMEA ID
   * @param column - The column to update
   * @param columnObject - The column object containing name, type, and dropdown options
   * @returns Updated FMEA object
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
   * Delete an FMEA by ID.
   *
   * @param id - The FMEA ID
   * @returns True if the FMEA was deleted; otherwise false
   */
  async deleteFmea(id: number): Promise<boolean | null> {
    const didDelete = await this.fmeaModel.deleteOne({ id: id });
    return didDelete.deletedCount > 0;
  }

  /**
   * Delete a column from an FMEA.
   *
   * @param fmeaId - The FMEA ID
   * @param column - The column to be deleted
   * @returns Updated FMEA object
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
   * Delete a row from an FMEA.
   *
   * @param fmeaId - The FMEA ID
   * @param rowId - The row ID to be deleted
   * @returns Updated FMEA object
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
   * Update a column's name.
   *
   * @param fmeaId - The FMEA ID
   * @param column - The column to be updated
   * @param newColumn - The new column name
   * @returns Updated FMEA object
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
   * Update a column's type and related details.
   *
   * @param fmeaId - The FMEA ID
   * @param body - Old column name and new column, dropdown options, and type
   * @returns Updated FMEA object
   */
  async updateColumnType(fmeaId: number, body): Promise<Fmea | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find((columnObject) => columnObject.id === body.id);
    // update the column name and type
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
   * Update column details (name, type, options).
   *
   * @param fmeaId - The FMEA id whose column should be updated
   * @param prev_name - Name of the column previously stored
   * @param column_body - Updated details of the column
   * @returns Updated FMEA object
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
      // Column identifiers (ids) align with the stored column name; use the previous
      // column identifier to update dropdown options for the correct column.
      result = await this.updateDropdownOptions(fmea.id, prev_name, column_body.dropdownOptions);
    }
    return result;
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
}
