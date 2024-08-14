import crypto from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { DropdownOption, FmeaType } from "shared-types/src/openpra-mef/fmea/fmea";
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

  /**
   * this was copied from elsewhere, its to create a counter
   * @param {string} name Name of the counter
   * @description
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no model exists, the serial ID starts from 1.
   * @returns {number} ID number
   */
  public async getNextValue(name: string) {
    const record = await this.ModelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.ModelCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  /**
   *
   * @param body containing title and description
   * @returns the FMEA object
   */
  public async createFmea(body: { title: string; description: string }): Promise<Fmea> {
    //create a new fmea using the body
    const newFmea = new this.fmeaModel({
      id: await this.getNextValue("FMEACounter"),
      title: body.title,
      description: body.description,
      columns: [],
      rows: [],
    });
    //save the fmea to the database
    return newFmea.save();
  }

  /**
   *
   * @param id the unique ID for each FMEA
   * @returns the FMEA found
   */
  public async getFmeaById(id: number): Promise<Fmea | null> {
    return this.fmeaModel.findOne({ id: id }).lean();
  }

  /**
   *
   * @returns Number of FMEAs in Database
   */
  public async getNumberOfFmea(): Promise<number> {
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
  public async addColumn(
    fmeaId: number,
    body: { name: string; type: string; dropdownOptions?: DropdownOption[] },
  ): Promise<Fmea | null> {
    const column = {
      id: crypto.randomUUID(),
      name: body.name,
      type: body.type,
      dropdownOptions: [] as DropdownOption[],
    };

    if (body.type === "dropdown" && body.dropdownOptions) {
      column.dropdownOptions = body.dropdownOptions;
    }

    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;

    // Initialize rows and columns if they are undefined
    fmea.rows = fmea.rows ?? [];
    fmea.columns = fmea.columns ?? [];

    //update the rows with the new column
    let valueToStore = "";
    if (column.type === "dropdown" && column.dropdownOptions.length > 0) {
      valueToStore = String(column.dropdownOptions[0].number);
    }

    for (const row of fmea.rows) {
      // Use the Map's set method to add or update key-value pairs
      row.row_data?.set(column.id, valueToStore);
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
  public async addRow(fmeaId: number): Promise<Fmea | null> {
    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
    const rowData = new Map<string, string>();
    if (!fmea.columns) {
      return null;
    }

    //loop over column of the fmea
    for (const column of fmea.columns) {
      if (column.type === "string") {
        rowData.set(String(column.id), "");
      } else if (column.type === "dropdown" && column.dropdownOptions) {
        rowData.set(String(column.id), String(column.dropdownOptions[0].number));
      }
    }

    const uuid = crypto.randomUUID();
    const row = {
      id: uuid,
      row_data: rowData,
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
  public async updateCell(fmeaId: number, rowId: number, column: string, value: string): Promise<Fmea | null> {
    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
    const columns = fmea.columns;
    if (!columns || !fmea.rows) {
      return null;
    }
    const columnObject = columns.find((columnObject) => columnObject.id === column);
    const row = fmea.rows.find((row) => row.id === rowId);

    if (!columnObject || !row) {
      return null;
    }
    if (columnObject.type === "dropdown") {
      const dropdownOptions = columnObject.dropdownOptions;
      if (!dropdownOptions) {
        return null;
      }

      dropdownOptions.find((dropdownOption) => dropdownOption.number === Number(value));
    }
    row.row_data?.set(column, value);

    // update the row_data for the given row in the database
    await this.fmeaModel
      .updateOne({ id: fmeaId, "rows.id": rowId }, { $set: { "rows.$.row_data": row.row_data } }, { new: true })
      .lean();
    return this.getFmeaById(fmeaId);
  }

  /**
   * @param {number} fmeaId the FMEA for which dropdown options need to be updated
   * @param {String}column for which dropdownoptions need to be updated
   * @param {Array}dropdownOptions updated array containing dropdown options
   * @description
   * if column type is string then do not update options
   * @returns the updated FMEA if updated else returns the unupdated FMEA
   */
  public async updateDropdownOptions(
    fmeaId: number,
    column: string,
    dropdownOptions: DropdownOption[],
  ): Promise<Fmea | null> {
    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
    const columns = fmea.columns;
    if (!columns || !fmea.rows) {
      return null;
    }

    const columnObject = columns.find((columnObject) => columnObject.id === column);
    if (!columnObject) {
      return null;
    }

    //do not update dropdown if column is of type string
    if (columnObject.type === "string") {
      return fmea as Fmea;
    }
    columnObject.dropdownOptions = dropdownOptions;
    for (const row of fmea.rows) {
      const storedValue = String(dropdownOptions[0].number);
      row.row_data?.set(column, storedValue);
    }
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { columns: columns, rows: fmea.rows } }, { new: true })
      .lean();
  }

  /**
   *
   * @param id the FMEA ID
   * @returns True if FMEA is deleted else false
   */
  public async deleteFmea(id: number): Promise<HttpStatus | null> {
    await this.fmeaModel.deleteOne({ id: id }).lean();
    return HttpStatus.NO_CONTENT;
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @param column the column to be deleted
   * @returns updated FMEA object
   */
  public async deleteColumn(fmeaId: number, column: string): Promise<Fmea | null> {
    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
    if (!fmea.columns || !fmea.rows) {
      return null;
    }
    fmea.columns = fmea.columns.filter((columnObject) => columnObject.id !== column);
    for (const row of fmea.rows) {
      //delete key
      row.row_data?.delete(column);
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
  public async deleteRow(fmeaId: number, rowId: number): Promise<Fmea | null> {
    //Get fmea object
    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
    if (!fmea.rows) {
      return null;
    }

    //remove the row from the rows array
    const rows = fmea.rows.filter((row) => row.id !== rowId);

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
  public async updateColumnName(fmeaId: number, column: string, newColumn: string): Promise<Fmea | null> {
    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
    if (!fmea.columns || !fmea.rows) {
      return null;
    }

    const columns = fmea.columns;
    const columnObject = columns.find((columnObject) => columnObject.id === column);
    if (!columnObject) {
      return null;
    }
    columnObject.name = newColumn;

    for (const row of fmea.rows) {
      const previousValue = row.row_data?.get(column);
      row.row_data?.delete(column);
      row.row_data?.set(column, String(previousValue));
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
  public async updateColumnType(
    fmeaId: number,
    body: { id: number; name: string; type: string; dropdownOptions: DropdownOption[] },
  ): Promise<Fmea | null> {
    const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
    const columns = fmea.columns;
    if (!columns || !fmea.rows) {
      return null;
    }

    const columnObject = columns.find((columnObject) => columnObject.id === String(body.id));
    if (!columnObject) {
      return null;
    }
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
    for (const row of fmea.rows) {
      //add key value pair to row_data
      row.row_data?.set(String(columnObject.id), valueToStore);
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
  public async updateColumnDetails(
    fmeaId: number,
    prev_name: string,
    column_body: { id: number; name: string; type: string; dropdownOptions: DropdownOption[] },
  ): Promise<Fmea | null> {
    const fmea = await this.fmeaModel.findOne({ id: fmeaId }).lean();
    if (!fmea || !fmea.columns) {
      return null;
    }
    const columns = fmea.columns;

    let result = null;
    const column = columns.find((column) => column.id === prev_name);
    if (!column) {
      return null;
    }

    if (column_body.name !== column.name) {
      result = await this.updateColumnName(Number(fmea.id), String(column.id), column_body.name);
    }
    if (column_body.type !== column.type) {
      result = await this.updateColumnType(Number(fmea.id), column_body);
    }
    if (column_body.type === "dropdown" && column_body.dropdownOptions !== column.dropdownOptions) {
      result = await this.updateDropdownOptions(Number(fmea.id), String(column_body.id), column_body.dropdownOptions);
    }

    return result;
  }
}

/**
 * this was copied from elsewhere, its to create a counter
 * @param {string} name Name of the counter
 * @description
 * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
 * @returns {number} ID number
async getValue(name: string): Promise<number> {
  const record = await this.ModelCounterModel.findById(name);
  if (!record) {
  throw new NotFoundException("Could not find FMEA model ID counter.");
}
return record.seq;
}
 **/

/**
 * @param {number} fmeaId the FMEA ID
 * @param {string} column the column to be updated
 * @param columnObject the column object containing name, type and dropdownoptions
 * @returns updated FMEA object
public async updateColumn(fmeaId: number, column: string, columnObject): Promise<Fmea | null> {
  const fmea = (await this.getFmeaById(fmeaId)) as FmeaType;
  const columns = fmea.columns;
  const columnObjectToUpdate = columns.find((columnObject) => columnObject.id === column);
  columnObjectToUpdate.name = columnObject.name;
  columnObjectToUpdate.type = columnObject.type;
  columnObjectToUpdate.dropdownOptions = columnObject.dropdownOptions;
  for (let i = 0; i < fmea.rows.length; i++) {
  const previousValue = fmea.rows[i].row_data.get(column);
  fmea.rows[i].row_data.delete(column);
  fmea.rows[i].row_data.set(columnObject.id, previousValue);
}
//update the column informations and rows in the database
return this.fmeaModel
  .findOneAndUpdate({ id: fmeaId }, { $set: { columns: columns, rows: fmea.rows } }, { new: true })
  .lean();
}
 **/
