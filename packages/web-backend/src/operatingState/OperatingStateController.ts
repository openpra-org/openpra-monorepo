import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from "@nestjs/common";
// import { Response } from "express";
import { OperatingState, OperatingStateDocument } from "../schemas/operatingState.schema";
import { OperatingStateService } from "./OperatingStateService";
interface Column {
  id: string;
  name: string;
  type: "text" | "number" | "dropdown";
  dropdownOptions?: { value: string; text: string }[];
}

// @Controller()
// export class OperatingStateController {
//   constructor(private readonly operatingStateService: OperatingStateService) {}
//   @Get("test")
//   async getStaticData() {
//     // Static data to be returned
//     const staticData = {
//       message: "This is a test endpoint.",
//       data: [
//         { id: 1, name: "Row 1", status: "Active" },
//         { id: 2, name: "Row 2", status: "Inactive" },
//         // Add more static data as needed
//       ],
//     };

//     return staticData;
//   }
//   @Get()
//   async getAllOperatingStates(): Promise<OperatingState[]> {
//     return this.operatingStateService.findAll();
//   }

//   // The method below is now properly typed to handle null values
//   @Get(":id")
//   async getOperatingStateById(
//     @Param("id") id: string,
//   ): Promise<OperatingState | null> {
//     const result =
//       await this.operatingStateService.getOperatingStateAnalysis(id);
//     if (!result) {
//       throw new NotFoundException(`OperatingState with ID ${id} not found`);
//     }
//     return result;
//   }

//   // @Post()
//   // async addOperatingState(@Body() operatingStateData: OperatingState) {
//   //   return this.operatingStateService.create(operatingStateData);
//   // }
//   @Post()
//   async createOperatingState(
//     @Body() data: Partial<OperatingState>,
//   ): Promise<OperatingStateDocument | null> {
//     return this.operatingStateService.create(data);
//   }

//   // @Patch(":id")
//   // async updateOperatingState(
//   //   @Param("id") id: string,
//   //   @Body() operatingStateData: OperatingState,
//   // ): Promise<OperatingState> {
//   //   const updated =
//   //     await this.operatingStateService.updateOperatingStateAnalysisLabel(
//   //       id,
//   //       operatingStateData,
//   //     );
//   //   if (!updated) {
//   //     throw new NotFoundException(`OperatingState with ID ${id} not found`);
//   //   }
//   //   return updated;
//   // }
//   @Patch(":id")
//   async updateOperatingStateAnalysisLabel(
//     @Param("id") id: string,
//     @Body() data: Partial<OperatingState>,
//   ): Promise<OperatingState | null> {
//     return this.operatingStateService.updateOperatingStateAnalysisLabel(
//       id,
//       data,
//     );
//   }

//   // @Delete(":id")
//   // async deleteOperatingState(@Query("id") id: string) {
//   //   return this.operatingStateService.delete(id);
//   // }

//   // @Post()
//   // async addRow(@Body() operatingStateData: OperatingState) {
//   //   return this.operatingStateService.create(operatingState);
//   // }
// }
@Controller("operating-states")
export class OperatingStateController {
  constructor(private readonly operatingStateService: OperatingStateService) {}
  @Put("/rows/:rowId/columns/:columnName")
  async updateRowData(
    @Param("rowId", ParseIntPipe) rowId: number,
    @Param("columnName") columnName: string,
    @Body("value") value: string,
  ): Promise<any> {
    const updateResult = await this.operatingStateService.updateRowData(rowId, columnName, value);
    if (updateResult.matchedCount === 0) {
      throw new NotFoundException(`Row with ID ${rowId} not found`);
    }
    if (updateResult.modifiedCount === 0) {
      throw new NotFoundException(`Row with ID ${rowId} not updated`);
    }
    return { message: "Row updated successfully", details: updateResult };
  }
  // Specific route for columns should come first
  @Get("/columns")
  async getAllColumns(): Promise<Column[]> {
    return await this.operatingStateService.findAllColumns();
  }
  // DELETE: Remove an existing OperatingState by custom ID
  @Delete("/columns/name/:name")
  async deleteColumn(@Param("name") name: string): Promise<any> {
    return this.operatingStateService.deleteColumn(name);
  }
  // POST: Create a new OperatingState
  @Post()
  async create(@Body() data: Partial<OperatingState>): Promise<OperatingStateDocument> {
    return await this.operatingStateService.create(data);
  }

  // GET: Retrieve all OperaingStates
  @Get()
  async findAll(): Promise<OperatingState[]> {
    return await this.operatingStateService.findAll();
  }

  // GET: Retrieve a specific OperatingState by custom ID
  @Get(":id")
  async findById(@Param("id") id: number): Promise<OperatingStateDocument> {
    const operatingState = await this.operatingStateService.findById(id);
    if (!operatingState) {
      throw new NotFoundException(`OperatingState with ID ${id} not found`);
    }
    return operatingState;
  }

  // PUT: Update an existing OperatingState by custom ID
  @Put(":id")
  async update(@Param("id") id: number, @Body() data: Partial<OperatingState>): Promise<OperatingStateDocument> {
    return await this.operatingStateService.update(id, data);
  }

  // Put /api/operating-states/columns/:id
  // @Put("/columns/:id")
  // async addColumn(
  //   @Param("id") id: number,
  //   @Body()
  //   columnData: {
  //     name: string;
  //     type: "text" | "number" | "dropdown";
  //     dropdownOptions?: { value: string; text: string }[];
  //   },
  // ): Promise<OperatingStateDocument> {
  //   return await this.operatingStateService.addColumn(id, columnData);
  // }

  @Delete(":id")
  async delete(@Param("id") id: number): Promise<void> {
    return await this.operatingStateService.delete(id);
  }

  // New routes for global columns management
  @Post("/columns")
  @HttpCode(201)
  async createColumn(
    @Body()
    columnData: {
      name: string;
      type: "text" | "number" | "dropdown";
      dropdownOptions?: { value: string; text: string }[];
    },
  ) {
    try {
      return await this.operatingStateService.createColumn(columnData);
    } catch (error: any) {
      // Type assert error as any
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: error.message || "Failed to create column",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put("/columns/:id")
  async updateColumn(
    @Param("id") id: string,
    @Body()
    columnData: {
      name: string;
      type: "text" | "number" | "dropdown";
      dropdownOptions?: { value: string; text: string }[];
    },
  ): Promise<void> {
    await this.operatingStateService.updateColumn(id, columnData);
  }

  // @Put("/rows/:rowId/columns/:columnName")
  // async updateRowData(
  //   // @Param("documentId") documentId: number,
  //   @Param("rowId") rowId: number,
  //   @Param("columnName") columnName: string,
  //   @Body("value") value: string,
  // ): Promise<{ message: string }> {
  //   await this.operatingStateService.updateRowData(rowId, columnName, value);
  //   return { message: "Row updated successfully" };
  // }
}
