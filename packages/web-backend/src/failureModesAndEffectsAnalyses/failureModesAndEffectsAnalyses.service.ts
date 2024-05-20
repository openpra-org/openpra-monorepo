import crypto from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import validator from "validator";
import {
  FailureModesAndEffectsAnalyses,
  FailureModesAndEffectsAnalysesDocument,
} from "../nestedModels/schemas/failure-modes-and-effects-analyses.schema";

export class failureModesAndEffectsAnalysesService {
  constructor(
    @InjectModel(FailureModesAndEffectsAnalyses.name)
    private readonly fmeaModel: mongoose.Model<FailureModesAndEffectsAnalysesDocument>,
  ) {}

  async getFmeaById(
    id: number,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaModel.findOne({ id: id }).lean();
  }

  async getAllFmea() {
    return this.fmeaModel.find().lean();
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
  async addColumn(
    fmeaId: number,
    body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    const column = {
      id: crypto.randomUUID(),
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
      .findOneAndUpdate(
        { id: fmeaId },
        { $set: { columns: fmea.columns, rows: fmea.rows } },
        { new: true },
      )
      .lean();
  }
  /**
   * @param {number} fmeaId the ID of the FMEA to retrieve
   * @description
   * Adds a new row to the FMEA
   * For columns of type dropdown the value is initialized as empty string and
   * For columns of type dropdown the value is initialized as the first option
   * @returns the FMEA with the added row
   */
  async addRow(fmeaId: number): Promise<FailureModesAndEffectsAnalyses | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const row_data = new Map<string, string>();
    //loop over column of the fmea
    for (let i = 0; i < fmea.columns.length; i++) {
      if (fmea.columns[i].type === "string") {
        row_data.set(fmea.columns[i].id, "");
      } else if (fmea.columns[i].type === "dropdown") {
        row_data.set(
          fmea.columns[i].id,
          String(fmea.columns[i].dropdownOptions[0].number),
        );
      }
    }
    const uuid = crypto.randomUUID();
    const row = {
      id: uuid,
      row_data: row_data,
    };

    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $push: { rows: row } }, { new: true })
      .lean();
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
  async updateCell(
    fmeaId: number,
    rowId: number,
    column: string,
    value: string,
  ): Promise<FailureModesAndEffectsAnalyses> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find(
      (columnObject) => columnObject.id === column,
    );
    const row = fmea.rows.find((row) => row.id === rowId);
    // if (columnObject === undefined || row === undefined) {
    //   return false;
    // }
    if (columnObject.type === "dropdown") {
      const dropdownOptions = columnObject.dropdownOptions;
      const dropdownOption = dropdownOptions.find(
        (dropdownOption) => dropdownOption.number === Number(value),
      );
      // if (dropdownOption === undefined) {
      //   console.log("Option not found");
      //   return false;
      // }
    }
    row.row_data[column] = value;

    // update the row_data for the given row in the database
    const updateResult = await this.fmeaModel
      .updateOne(
        { id: fmeaId, "rows.id": rowId },
        { $set: { "rows.$.row_data": row.row_data } },
        { new: true },
      )
      .lean();
    const result = await this.getFmeaById(fmeaId);
    return result;
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
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find(
      (columnObject) => columnObject.id === column,
    );
    console.log(columnObject);

    //do not update dropdown if column is of type string
    if (columnObject.type === "string") {
      return fmea;
    }
    columnObject.dropdownOptions = dropdownOptions;
    for (let i = 0; i < fmea.rows.length; i++) {
      const storedValue = String(dropdownOptions[0].number);
      fmea.rows[i].row_data[column] = storedValue;
    }
    return this.fmeaModel
      .findOneAndUpdate(
        { id: fmeaId },
        { $set: { columns: columns, rows: fmea.rows } },
        { new: true },
      )
      .lean();
  }
  /**
   * @param {number} fmeaId the FMEA ID
   * @param {string} column the column to be updated
   * @param columnObject the column object containing name, type and dropdownoptions
   * @returns updated FMEA object
   */
  async updateColumn(
    fmeaId: number,
    column: string,
    columnObject,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObjectToUpdate = columns.find(
      (columnObject) => columnObject.id === column,
    );
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
      .findOneAndUpdate(
        { id: fmeaId },
        { $set: { columns: columns, rows: fmea.rows } },
        { new: true },
      )
      .lean();
  }
  /**
   *
   * @param id the FMEA ID
   * @returns True if FMEA is deleted else false
   */
  async deleteFmea(id: number): Promise<boolean | null> {
    const didDelete = this.fmeaModel.deleteOne({ id: id }).lean();
    return (await didDelete).deletedCount > 0;
  }
  /**
   *
   * @param fmeaId the FMEA ID
   * @param column the column to be deleted
   * @returns updated FMEA object
   */
  async deleteColumn(
    fmeaId: number,
    column: string,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    const fmea = await this.getFmeaById(fmeaId);
    fmea.columns = fmea.columns.filter(
      (columnObject) => columnObject.id != column,
    );
    for (let i = 0; i < fmea.rows.length; i++) {
      //delete key
      delete fmea.rows[i].row_data[column];
    }
    return this.fmeaModel
      .findOneAndUpdate(
        { id: fmeaId },
        { $set: { columns: fmea.columns, rows: fmea.rows } },
        { new: true },
      )
      .lean();
  }
  /**
   *
   * @param fmeaId the FMEA ID
   * @param rowId the row ID to be deleted
   * @returns updated FMEA object
   */
  async deleteRow(
    fmeaId: number,
    rowId: number,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    //get fmea object
    const fmea = await this.getFmeaById(fmeaId);
    //remove the row from the rows array
    const rows = fmea.rows.filter((row) => row.id != rowId);

    console.log(rows);
    //update the rows in the database
    return this.fmeaModel
      .findOneAndUpdate({ id: fmeaId }, { $set: { rows: rows } }, { new: true })
      .lean();
  }
  async deleteRows(
    fmeaId: number,
    body: any,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    // Get the Fmea object
    const fmea = await this.getFmeaById(fmeaId);
    // Remove the rows from the rows array whose IDs are in the rowIds array
    const filteredRows = fmea.rows.filter(
      (row) => !body.rowIds.includes(row.id),
    );

    console.log(filteredRows);
    // Update the rows in the database
    return this.fmeaModel
      .findOneAndUpdate(
        { id: fmeaId },
        { $set: { rows: filteredRows } },
        { new: true },
      )
      .lean();
  }
  /**
   *
   * @param fmeaId the FMEA ID
   * @param column the column to be updated
   * @param newColumn the new column name
   * @returns updated FMEA object
   */
  async updateColumnName(
    fmeaId: number,
    column: string,
    newColumn: string,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find(
      (columnObject) => columnObject.id === column,
    );
    columnObject.name = newColumn;
    for (let i = 0; i < fmea.rows.length; i++) {
      const previousValue = fmea.rows[i].row_data[column];
      delete fmea.rows[i].row_data[column];
      fmea.rows[i].row_data[column] = previousValue;
    }
    //update the column informations and rows in the database
    return this.fmeaModel
      .findOneAndUpdate(
        { id: fmeaId },
        { $set: { columns: columns, rows: fmea.rows } },
        { new: true },
      )
      .lean();
  }
  /**
   *
   * @param fmeaId the FMEA ID
   * @param body old column name and new column, dropdown options and type
   * @returns
   */
  async updateColumnType(
    fmeaId: number,
    body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    const fmea = await this.getFmeaById(fmeaId);
    const columns = fmea.columns;
    const columnObject = columns.find(
      (columnObject) => columnObject.id === body.id,
    );
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
      .findOneAndUpdate(
        { id: fmeaId },
        { $set: { columns: fmea.columns, rows: fmea.rows } },
        { new: true },
      )
      .lean();
  }
  /**
   *
   * @param prev_name name of column previously stored
   * @param column_body updated details of the column
   * @returns updated FMEA object
   */
  async updateColumnDetails(
    fmeaId: number,
    prev_name: string,
    column_body: any,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    const fmea = await this.fmeaModel.findOne({ id: fmeaId }).lean();
    const columns = fmea.columns;
    let result;
    const column = columns.find((column) => column.id === prev_name);
    if (column_body.name != column.name) {
      result = await this.updateColumnName(
        fmea.id,
        column.id,
        column_body.name,
      );
    }
    if (column_body.type != column.type) {
      result = await this.updateColumnType(fmea.id, column_body);
    }
    if (
      column_body.type === "dropdown" &&
      column_body.dropdownOptions != column.dropdownOptions
    ) {
      result = await this.updateDropdownOptions(
        fmea.id,
        column_body.id,
        column_body.dropdownOptions,
      );
    }
    return result;
  }

  async getRowById(fmeaId: number, rowId: string) {
    const document = await this.fmeaModel.findOne(
      { id: fmeaId, "rows.id": rowId },
      { "rows.$": 1 },
    );
    if (document && document.rows && document.rows.length > 0) {
      const row = document.rows[0];
      const result = {
        id: row.id,
        rowData: row.row_data,
      };
      console.log("Found row:", result);
      return result;
    }
  }
}
