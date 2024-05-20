import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Delete,
} from "@nestjs/common";

import { failureModesAndEffectsAnalysesService } from "./failureModesAndEffectsAnalyses.service";
import { FailureModesAndEffectsAnalyses } from "../nestedModels/schemas/failure-modes-and-effects-analyses.schema";

@Controller()
export class FailureModesAndEffectsAnalysesController {
  constructor(
    private readonly fmeaService: failureModesAndEffectsAnalysesService,
  ) {}
  /**
   *
   * @param id FMEA ID
   * @returns the FMEA object
   */
  @Post(":id")
  async getFmea(
    @Param("id") id: number,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.getFmeaById(id);
  }
  @Get()
  async getAllFmea(): Promise<any[]> {
    let fmeas = this.fmeaService.getAllFmea();
    return fmeas;
  }
  /**
   *
   * @param id FMEA ID
   * @param body contains name of column, type of column, dropdownoptions
   * @description
   * dropdownoption can be empty or non existent for column of type string
   * @returns
   */
  @Put(":id/column")
  async addColumn(
    @Param("id") id: number,
    @Body() body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.addColumn(id, body);
  }
  /**
   *
   * @param id for the FMEA
   * @returns
   */
  @Put(":id/row")
  async addRow(
    @Param("id") id: number,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.addRow(id);
  }
  /**
   *
   * @param id FMEA ID
   * @param body contains row ID, column to be updated and updated cell value
   * @returns the updated FMEA object
   */
  @Put(":id/cell")
  async updateCell(
    @Param("id") id: number,
    @Body() body,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return this.fmeaService.updateCell(id, body.rowId, body.column, body.value);
  }
  /**
   *
   * @param id the FMEA ID
   * @param body contains column name and dropdownoptions
   * @returns updated FMEA object
   */
  @Put(":id/dropdown")
  async updateDropdownOptions(
    @Param("id") id: number,
    @Body() body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.updateDropdownOptions(
      id,
      body.column,
      body.dropdownOptions,
    );
  }
  /**
   *
   * @param fmeaId the FMEA ID
   * @param column the column to be deleted
   * @returns
   */
  @Put(":fmeaid/:column/delete")
  async deleteColumn(
    @Param("fmeaid") fmeaId: number,
    @Param("column") column: string,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.deleteColumn(fmeaId, column);
  }

  @Delete(":fmeaid/:rowid/delete")
  async deleteRow(
    @Param("fmeaid") fmeaId: number,
    @Param("rowid") rowId: number,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.deleteRow(fmeaId, rowId);
  }
  @Delete(":fmeaid/rows")
  async deleteRows(
    @Param("fmeaid") fmeaId: number,
    @Body() body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.deleteRows(fmeaId, body);
  }
  /**
   *
   * @param fmeaId the FMEA ID
   * @returns
   */
  @Put(":id/delete")
  async deleteFmea(@Param("id") fmeaId: number): Promise<Boolean | null> {
    return this.fmeaService.deleteFmea(fmeaId);
  }
  /**
   *
   * @param id the FMEA ID
   * @param body contains column name and new column name
   * @returns
   */
  @Put(":id/column/updateName")
  async updateColumnName(
    @Param("id") id: number,
    @Body() body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.updateColumnName(
      id,
      body.column,
      body.newColumnName,
    );
  }
  /**
   *
   * @param id the FMEA ID
   * @param body oldColumn: column name, newColumn: new column name, dropdownOptions: sdropdown options, type: type of new column
   * @returns
   */
  @Put(":id/column/updateType")
  async updateColumnType(
    @Param("id") id: number,
    @Body() body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.updateColumnType(id, body);
  }
  /**
   *
   * @param column the column name
   * @param body contains new column name, type of column, dropdown options
   * @returns
   */
  @Put(":id/:column/update")
  async updateColumn(
    @Param("id") fmeaId: number,
    @Param("column") prev_column_name: string,
    @Body() body,
  ): Promise<FailureModesAndEffectsAnalyses | null> {
    return this.fmeaService.updateColumnDetails(fmeaId, prev_column_name, body);
  }

  @Get("/:id/row/:rowId")
  async getRowById(@Param("id") fmeaId: number, @Param("rowId") rowId: string) {
    return this.fmeaService.getRowById(fmeaId, rowId);
  }
}
