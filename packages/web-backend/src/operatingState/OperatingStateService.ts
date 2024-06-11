import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { OperatingState, OperatingStateDocument } from "../schemas/operatingState.schema";
interface Column {
  _id?: any;
  id: string;
  name: string;
  type: "text" | "number" | "dropdown";
  dropdownOptions?: { value: string; text: string }[];
}

// @Injectable()
// export class OperatingStateService {
//   constructor(
//     @InjectModel(OperatingState.name)
//     private operatingStateModel: mongoose.Model<OperatingStateDocument>,
//     @InjectModel(ColumnConfig.name)
//     private columnConfigModel: mongoose.Model<ColumnConfigDocument>,
//   ) {}

//   /**
//    * Save the graph document
//    * @param graph - Graph document
//    * @param body - Model data
//    * @param modelType - Type of graph model
//    * @returns Graph document, after saving it in the database
//    */
//   private async saveState(
//     existingOperatingState: OperatingStateDocument | null,
//     body: Partial<OperatingState>,
//   ): Promise<OperatingStateDocument> {
//     if (existingOperatingState) {
//       Object.assign(existingOperatingState, body);
//       return await existingOperatingState.save();
//     } else {
//       const newOperatingState = new this.operatingStateModel(body);

//       newOperatingState.id = body.id || this.generateUniqueId();
//       newOperatingState._id = new mongoose.Types.ObjectId();
//       return newOperatingState.save();
//     }
//   }

//   // Generate a unique ID for OperatingState
//   private generateUniqueId(): string {
//     return (
//       new Date().getTime().toString(36) + Math.random().toString(36).slice(2)
//     );
//   }

//   async findAll(): Promise<OperatingState[]> {
//     console.log("findall");

//     return this.operatingStateModel.find().exec();
//   }
//   /**
//    * Saves the fault tree diagram graph
//    * @param body - The current state of the fault tree diagram graph
//    * @returns A promise with a fault tree diagram graph in it
//    */
//   async saveOperatingState(
//     body: Partial<OperatingState>,
//   ): Promise<OperatingStateDocument> {
//     const existingOperatingState = await this.operatingStateModel.findOne({
//       id: body.id,
//     });
//     return this.saveState(existingOperatingState, body);
//   }

//   /**
//    * Sets the fault tree diagram graph for the given fault tree ID
//    * @param faultTreeId - Fault tree ID
//    * @returns A promise with the fault tree diagram graph
//    */
//   async getOperatingStateAnalysis(id: string): Promise<OperatingState | null> {
//     const result = this.operatingStateModel
//       .findOne(
//         { id: id },
//         // { _id: 0 },
//       )
//       .exec();
//     if (!result) {
//       throw new NotFoundException(`OperatingState with ID ${id} not found`);
//     }
//     return result;
//   }

//   async create(
//     operatingStateData: Partial<OperatingState>,
//   ): Promise<OperatingStateDocument | null> {
//     if (operatingStateData.id === undefined) {
//       // Generate a unique ID or let MongoDB handle it
//       operatingStateData.id = Date.now();
//     }
//     const createdRow = new this.operatingStateModel(operatingStateData);
//     return createdRow.save();
//   }
//   async findOne(id: string): Promise<OperatingStateDocument | null> {
//     return this.operatingStateModel.findById(id).exec();
//     // console.log(result);
//     // return result;
//   }

//   async updateOperatingStateAnalysisLabel(
//     id: string,
//     body: Partial<OperatingState>,
//   ): Promise<OperatingState | null> {
//     return this.operatingStateModel
//       .findOneAndUpdate({ id: id }, body, { new: true })
//       .exec();
//   }

//   async delete(id: string): Promise<{ deleted: boolean }> {
//     const result = await this.operatingStateModel.findByIdAndRemove(id).exec();
//     return { deleted: !!result };
//   }
// }
@Injectable()
export class OperatingStateService {
  constructor(
    @InjectModel(OperatingState.name)
    private operatingStateModel: Model<OperatingStateDocument>,
  ) {}

  // CREATE
  // async create(data: Partial<OperatingState>): Promise<OperatingStateDocument> {
  //   const createdOperatingState = new this.operatingStateModel(data);
  //   return createdOperatingState.save();
  // }
  async create(data: Partial<OperatingState>): Promise<OperatingStateDocument> {
    const createdOperatingState = new this.operatingStateModel({
      ...data,
      rows: data.rows || [], // Ensuring rows is always initialized as an array
    });
    return await createdOperatingState.save();
  }

  // READ all
  async findAll(): Promise<OperatingState[]> {
    return this.operatingStateModel.find().exec();
  }

  // READ by custom ID
  async findById(id: number): Promise<OperatingStateDocument> {
    const operatingState = await this.operatingStateModel.findOne({ id }).exec();
    if (!operatingState) {
      throw new NotFoundException(`OperatingState with ID ${id} not found`);
    }
    return operatingState;
  }

  //ORIGINAL UPDATE
  async update(id: number, data: Partial<OperatingState>): Promise<OperatingStateDocument> {
    const updatedOperatingState = await this.operatingStateModel.findOneAndUpdate({ id }, data, { new: true }).exec();
    if (!updatedOperatingState) {
      throw new NotFoundException(`OperatingState with ID ${id} not found`);
    }
    return updatedOperatingState;
  }
  // // UPDATE with support for dynamic columns
  // // Method to add/update data in an existing OperatingState
  // async update(
  //   id: number,
  //   data: Partial<OperatingState>,
  // ): Promise<OperatingStateDocument> {
  //   // Type guard to check for the presence and non-empty array of columns
  //   if (!data.columns || data.columns.length === 0) {
  //     throw new Error("No new columns provided.");
  //   }

  //   const currentState = await this.operatingStateModel.findOne({ id }).exec();
  //   if (!currentState) {
  //     throw new NotFoundException(`OperatingState with ID ${id} not found`);
  //   }

  //   // Check if there are new columns to be added and initialize them if necessary
  //   if (currentState.columns.length < data.columns?.length) {
  //     // Use optional chaining here
  //     currentState.rows.forEach((row) => {
  //       data.columns?.forEach((col) => {
  //         // Use optional chaining here as well
  //         if (!row.row_data) {
  //           row.row_data = new Map<string, any>();
  //         }
  //         if (!row.row_data.has(col.name)) {
  //           row.row_data.set(col.name, this.getDefaultValueForColumn(col));
  //         }
  //       });
  //     });
  //     await currentState.save(); // Save after modifications
  //   }

  //   // Finally update the state with potentially new data
  //   const updatedOperatingState = await this.operatingStateModel
  //     .findOneAndUpdate({ id }, { $set: data }, { new: true })
  //     .exec();

  //   if (!updatedOperatingState) {
  //     throw new NotFoundException(`OperatingState with ID ${id} not found`);
  //   }

  //   return updatedOperatingState;
  // }
  //currently checking---
  // async update(
  //   id: number,
  //   data: Partial<OperatingState>,
  // ): Promise<OperatingStateDocument> {
  //   // First, find the existing document by ID
  //   const currentState = await this.operatingStateModel.findOne({ id }).exec();
  //   if (!currentState) {
  //     throw new NotFoundException(`OperatingState with ID ${id} not found`);
  //   }

  //   // Update the state directly with new data, assuming `data` now directly contains the properties to be updated
  //   const updatedOperatingState = await this.operatingStateModel
  //     .findOneAndUpdate({ id }, { $set: data }, { new: true })
  //     .exec();

  //   if (!updatedOperatingState) {
  //     throw new NotFoundException(
  //       `Failed to update Operating State with ID ${id}`,
  //     );
  //   }

  //   return updatedOperatingState;
  // }
  //-----------------------------

  // Method to add a new column to an existing OperatingState
  // async addColumn(
  //   id: number,
  //   columnData: {
  //     name: string;
  //     type: "text" | "number" | "dropdown";
  //     dropdownOptions?: { value: string; text: string }[];
  //   },
  // ): Promise<OperatingStateDocument> {
  //   const operatingState = await this.operatingStateModel.findById(id).exec();
  //   if (!operatingState) {
  //     throw new NotFoundException(`OperatingState with ID ${id} not found`);
  //   }
  //   // Generate a unique ID for the new column, you might use another method to ensure uniqueness
  //   const columnId = Date.now().toString(); // Example ID generation method

  //   // Include the generated ID in the column data
  //   const newColumnData = {
  //     id: columnId,
  //     ...columnData,
  //   };

  //   operatingState.columns.push(newColumnData);
  //   return operatingState.save();
  // }

  // DELETE
  async delete(id: number): Promise<void> {
    const result = await this.operatingStateModel.findOneAndDelete({ id }).exec();
    if (!result) {
      throw new NotFoundException(`OperatingState with ID ${id} not found`);
    }
  }

  // //columns:
  // // Method to add a new column to all operating states
  // async createColumn(columnData: {
  //   name: string;
  //   type: "text" | "number" | "dropdown";
  //   dropdownOptions?: { value: string; text: string }[];
  // }): Promise<any> {
  //   const result = await this.operatingStateModel.updateMany(
  //     {},
  //     { $push: { columns: columnData } },
  //   );
  //   if (result.modifiedCount === 0) {
  //     throw new Error("No documents were updated.");
  //   }
  //   console.log("Column added:", columnData);
  //   console.log("Update result:", result);
  //   return {
  //     message: "Column added successfully",
  //     addedColumn: columnData,
  //     modifiedCount: result.modifiedCount,
  //   };
  //   // return result;
  // }

  //------first two rows updated correctly-----------------------
  // async createColumn(columnData: {
  //   name: string;
  //   type: "text" | "number" | "dropdown";
  //   dropdownOptions?: { value: string; text: string }[];
  // }): Promise<any> {
  //   // Determine the default value based on column type
  //   const defaultValue = this.getDefaultValueForColumn(columnData);

  //   // First, ensure all documents have 'rows' as an array
  //   await this.operatingStateModel.updateMany(
  //     { rows: { $exists: true, $not: { $type: "array" } } },
  //     { $set: { rows: [] } },
  //   );

  //   // Define operations for bulkWrite to add column and set default values
  //   const operations = (await this.operatingStateModel.find()).map((doc) => ({
  //     updateOne: {
  //       filter: { _id: doc._id },
  //       update: {
  //         $push: {
  //           columns: {
  //             id: new mongoose.Types.ObjectId().toString(),
  //             name: columnData.name,
  //             type: columnData.type,
  //             dropdownOptions: columnData.dropdownOptions || [],
  //           },
  //         },
  //         $set: {
  //           // Dynamically add the default value to each row's row_data
  //           [`rows.$[].row_data.${columnData.name}`]: defaultValue,
  //         },
  //       },
  //     },
  //   }));

  //   // Execute bulkWrite to apply the operations
  //   const result = await this.operatingStateModel.bulkWrite(operations as any);
  //   const addedColumn = {
  //     id: operations[operations.length - 1].updateOne.update.$push.columns.id,
  //     name: columnData.name,
  //     type: columnData.type,
  //     dropdownOptions: columnData.dropdownOptions,
  //   };
  //   return {
  //     message:
  //       "Column added successfully with default values set for all rows.",
  //     addedColumn: addedColumn,
  //     result: result,
  //   };
  // }

  // // Helper method to determine the default value based on column type
  // private getDefaultValueForColumn(columnData: {
  //   type: "text" | "number" | "dropdown";
  //   dropdownOptions?: { value: string; text: string }[];
  // }): any {
  //   switch (columnData.type) {
  //     case "text":
  //       return "";
  //     case "number":
  //       return 0;
  //     case "dropdown":
  //       return columnData.dropdownOptions &&
  //         columnData.dropdownOptions.length> 0
  //         ? columnData.dropdownOptions[0].value
  //         : ""; // Default for dropdown type if no options are defined
  //     // return columnData.dropdownOptions?.[0].value || "";
  //     // Default for dropdown type
  //     default:
  //       return "";
  //   }
  // }
  //----------------------------------------------------------
  // Function to create a new column and add it to all operating states

  async createColumn(columnData: {
    name: string;
    type: "text" | "number" | "dropdown";
    dropdownOptions?: { value: string; text: string }[];
  }): Promise<any> {
    const defaultValue = this.getDefaultValueForColumn(columnData);

    const result = await this.operatingStateModel.updateMany(
      {}, // Update all documents
      {
        $push: { columns: columnData }, // Add new column to the columns array
        $set: { "rows.$[].row_data": { [columnData.name]: defaultValue } }, // Set default value for new column in all rows
      },
    );

    if (result.modifiedCount === 0) {
      throw new Error("No documents were updated.");
    }

    return {
      message: "Column added successfully",
      addedColumn: columnData,
      modifiedCount: result.modifiedCount,
    };
  }

  private getDefaultValueForColumn(columnData: {
    type: "text" | "number" | "dropdown";
    dropdownOptions?: { value: string; text: string }[];
  }): any {
    switch (columnData.type) {
      case "text":
        return ""; // Default value for text
      case "number":
        return 0; // Default value for number
      case "dropdown":
        return columnData.dropdownOptions?.[0]?.value || ""; // Default value for dropdown
      default:
        return "";
    }
  }
  // // Method to retrieve all columns (assuming columns are stored in a specific way)
  // async findAllColumns(): Promise<Column[]> {
  //   const allStates = await this.operatingStateModel
  //     .find({}, "columns -_id")
  //     .exec(); // Fetch only the columns field
  //   if (!allStates.length) {
  //     throw new NotFoundException("No operating states found");
  //   }

  //   // Extract columns from the first available state that has them, ensuring no undefined access
  //   const firstStateWithColumns = allStates.find(
  //     (state) => state.columns && state.columns.length,
  //   );
  //   if (!firstStateWithColumns) {
  //     throw new NotFoundException("No columns found in any operating state");
  //   }
  //   return firstStateWithColumns.columns;
  // }
  // Assuming allStates is the result from the database query
  async findAllColumns(): Promise<Column[]> {
    const allStates = await this.operatingStateModel.find({}, "columns -_id").exec(); // Fetch only the columns field

    if (!allStates.length) {
      throw new NotFoundException("No operating states found");
    }

    // Standardizing column data and ensuring type consistency
    return allStates
      .map((state) => state.columns)
      .flat()
      .map((column: any) => ({
        id: column.id || column._id.toString(), // Assure TypeScript about the presence of _id
        name: column.displayAsText || column.name,
        type: column.columnType || column.type,
        dropdownOptions: column.dropdownOptions || [],
      }));
  }

  // Method to update a specific column across all operating states
  async updateColumn(
    id: string,
    columnData: {
      name: string;
      type: "text" | "number" | "dropdown";
      dropdownOptions?: { value: string; text: string }[];
    },
  ): Promise<void> {
    const updated = await this.operatingStateModel.updateMany(
      { "columns.id": id },
      { $set: { "columns.$": columnData } }, // Use positional operator to update specific column
    );
    if (!updated) {
      throw new NotFoundException(`OperatingState with column ID ${id} not found`);
    }
  }

  // Method to delete a specific column from all operating states
  async deleteColumn(name: string): Promise<any> {
    console.log("Attempting to delete column with name:", name);
    const result = await this.operatingStateModel.updateMany(
      { "columns.name": name },
      { $pull: { columns: { name: name } } },
    );
    if (result.modifiedCount === 0) {
      throw new NotFoundException(`No columns with name ${name} were found to delete`);
    }
    console.log("deletion result: ", result);
    return result; // This will return the deletion result
  }
  async updateRowData(rowId: number, columnName: string, value: string): Promise<any> {
    // Since we're using findOneAndUpdate, ensure the filter and update operators are correctly used.
    const updateResult = await this.operatingStateModel.findOneAndUpdate(
      { "rows.id": rowId },
      // `rows.$.row_data.${columnName}`
      { $set: { ["rows.$.row_data." + columnName]: value } },
      {
        new: true, // Return the updated document
        arrayFilters: [{ "rows.id": rowId }], // Ensure the update applies only to the specific row
      },
    );

    if (!updateResult) {
      throw new Error(`Unable to update row with ID ${rowId}.`);
    }
    return updateResult;
  }
  // async updateRowData(
  //   rowId: number,
  //   columnName: string,
  //   value: string,
  // ): Promise<any> {
  //   const updateResult = await this.operatingStateModel.updateOne(
  //     { "rows.id": rowId.toString() }, // Filtering by row ID directly
  //     { $set: { "rows.$.row_data": { [columnName]: value } } }, // Update the specific column in row_data
  //     {
  //       arrayFilters: [{ "rows.id": rowId.toString() }], // Specify the array filter
  //     },
  //   );
  //   console.log("Updating row data", { rowId, columnName, value });
  //   console.log("Update Command", {
  //     "rows.$.row_data": { [columnName]: value },
  //   });
  //   const document = await this.operatingStateModel.findOne({
  //     "rows.id": rowId.toString(),
  //   });
  //   console.log("Document found:", document);

  //   if (updateResult.matchedCount === 0) {
  //     throw new NotFoundException(`Row with ID ${rowId} not found`);
  //   }
  //   if (updateResult.modifiedCount === 0) {
  //     throw new NotFoundException(`Row with ID ${rowId} not updated`);
  //   }
  //   return { message: "Row updated successfully", details: updateResult };
  // }

  // /**
  //  * Updates data for a specific row and column in an OperatingState.
  //  */
  // async updateRowData(
  //   rowId: number,
  //   columnName: string,
  //   value: string,
  // ): Promise<any> {
  //   // Define the path to the nested field dynamically
  //   const dataPath = `rows.$.row_data.${columnName}`;

  //   // Perform the update
  //   const result = await this.operatingStateModel.findOneAndUpdate(
  //     { "rows.id": rowId }, // Find the document with the matching row
  //     { $set: { [dataPath]: value } }, // Set the new value for the specified column in the row
  //     {
  //       arrayFilters: [{ "rows.id": rowId }], // Ensures the update applies only to the specific row
  //       new: true, // Returns the modified document
  //     },
  //   );

  //   // Check if the document was found and updated
  //   if (!result) {
  //     throw new NotFoundException(
  //       `Row with ID ${rowId} not found or update failed`,
  //     );
  //   }
  //   console.log("updated result: ", result);

  //   return { message: "Row updated successfully", details: result };
  // }
  // async updateRowData(
  //   rowId: number,
  //   columnName: string,
  //   value: string,
  // ): Promise<any> {
  //   console.log(
  //     `Attempting to update rowId: ${rowId}, Column: ${columnName} with value: ${value}`,
  //   );

  //   // Log the document before update
  //   const docBeforeUpdate = await this.operatingStateModel.findOne({
  //     "rows.id": rowId,
  //   });
  //   console.log("Document before update:", docBeforeUpdate);

  //   // // Check if the document was actually found
  //   // if (!docBeforeUpdate) {
  //   //   console.log(`No document found with rowId: ${rowId}`);
  //   //   throw new NotFoundException(`Document with rowId: ${rowId} not found`);
  //   // }

  //   // // Verify that 'row_data' is initialized
  //   // if (!docBeforeUpdate.rows[0].row_data) {
  //   //   docBeforeUpdate.rows[0].row_data = new Map<string, string>();
  //   //   await docBeforeUpdate.save();
  //   //   console.log("Initialized row_data map:", docBeforeUpdate);
  //   // }

  //   // const result = await this.operatingStateModel.updateOne(
  //   //   { "rows.id": rowId },
  //   //   { $set: { [`rows.$.row_data.${columnName}`]: value } },
  //   //   { new: true },
  //   // );

  //   // const result = await this.operatingStateModel.updateOne(
  //   //   { "rows.id": rowId },
  //   //   { $set: { "rows.$.row_data": { [columnName]: value } } }, // Use a simpler object assignment
  //   // );

  //   const result = await this.operatingStateModel.findOneAndUpdate(
  //     { "rows.id": rowId },
  //     { $set: { [`rows.$.row_data.${columnName}`]: value } },
  //     { new: true },
  //   );
  //   if (!result) {
  //     throw new NotFoundException(
  //       `Row with ID ${rowId} not found or update failed`,
  //     );
  //   }

  //   return { message: "Row updated successfully", details: result };
  //   // console.log("Update result:", result);

  //   // if (result.matchedCount === 0) {
  //   //   throw new NotFoundException(`Row with ID ${rowId} not found`);
  //   // }
  //   // if (result.modifiedCount === 0) {
  //   //   console.log(
  //   //     "No changes were made. Possibly the value is the same or the path is incorrect.",
  //   //   );
  //   //   return { message: "No changes were made", details: result };
  //   // }

  //   // return { message: "Row updated successfully", details: result };
  // }

  // async updateRowData(
  //   rowId: number,
  //   columnName: string,
  //   value: string,
  // ): Promise<any> {
  //   console.log(
  //     `Updating rowId: ${rowId}, Column: ${columnName} with value: ${value}`,
  //   );

  //   const result = await this.operatingStateModel.updateOne(
  //     { "rows.id": rowId },
  //     { $set: { [`rows.$.row_data.${columnName}`]: value } },
  //     { new: true },
  //   );

  //   console.log("Update result:", result);

  //   if (result.matchedCount === 0) {
  //     throw new NotFoundException(`Row with ID ${rowId} not found`);
  //   }
  //   if (result.modifiedCount === 0) {
  //     console.log("No changes were made.");
  //     return { message: "No changes were made", details: result };
  //   }

  //   return { message: "Row updated successfully", details: result };
  // }

  // async updateRowData(
  //   rowId: number,
  //   columnName: string,
  //   value: string,
  // ): Promise<any> {
  //   // Ensure to return Promise<any>

  //   const rowIdQuery = Number(rowId); // or String(rowId) based on the actual stored type

  //   const result = await this.operatingStateModel.updateOne(
  //     { "rows.id": rowId },
  //     { $set: { [`rows.$.row_data.${columnName}`]: value } },
  //   );

  //   if (result.matchedCount === 0) {
  //     throw new NotFoundException(`Row with ID ${rowId} not found`);
  //   }
  //   if (result.modifiedCount === 0) {
  //     throw new NotFoundException(`Row with ID ${rowId} not updated`);
  //   }

  //   return result; // Make sure to return this value
  // }
  // async updateRowData(
  //   rowId: number,
  //   columnName: string,
  //   value: string,
  // ): Promise<void> {
  //   // Attempt to update the map entry directly within the row
  //   const result = await this.operatingStateModel.updateOne(
  //     { "rows.id": rowId },
  //     { $set: { [`rows.$.row_data.${columnName}`]: value } },
  //     { new: true },
  //   );

  //   console.log(result);
  //   // Check if the document was found and updated
  //   if (result.matchedCount === 0) {
  //     throw new NotFoundException(`Row with ID ${rowId} not found`);
  //   }
  //   if (result.modifiedCount === 0) {
  //     throw new NotFoundException(`Row with ID ${rowId} not updated`);
  //   }
  // }
  // async updateRowData(
  //   // documentId: number,
  //   rowId: number,
  //   columnName: string,
  //   value: string,
  // ): Promise<void> {
  //   // Find the document by the document ID
  //   const operatingState = await this.operatingStateModel.findOne({
  //     "rows.id": rowId,
  //   });
  //   if (!operatingState) {
  //     throw new NotFoundException(`Document with ID ${rowId} not found`);
  //   }

  //   // Find the specific row in the 'rows' array
  //   const row = operatingState.rows.find((r) => Number(r.id) === Number(rowId));
  //   if (!row) {
  //     throw new NotFoundException(`Row with ID ${rowId} not found`);
  //   }

  //   // Update the column value in the row
  //   row.row_data.set(columnName, value);
  //   // if (row.row_data && row.row_data.hasOwnProperty(columnName)) {
  //   //   row.row_data[columnName] = value;
  //   // } else {
  //   //   throw new NotFoundException(`Column ${columnName} not found in row`);
  //   // }

  //   // Save the modified document
  //   await operatingState.save();
  // }
}
