import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Delete,
} from "@nestjs/common";
import { FmeaService } from "./fmea.service";
import { Fmea } from "./schemas/fmea.schema";

@Controller()
export class FmeaController {
  constructor(private readonly fmeaService: FmeaService) {}

  /**
   *
   * @param body
   * @returns created FMEA object
   */
  @Post()
  async createFmea(@Body() body): Promise<Fmea> {
    const createdFmea = this.fmeaService.createFmea(body);
    return createdFmea;
  }

  /**
   *
   * @param id FMEA ID
   * @returns the FMEA object
   */
  @Get(":id")
  async getFmea(@Param("id") id: number): Promise<Fmea | null> {
    return this.fmeaService.getFmeaById(id);
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
  async addColumn(@Param("id") id: number, @Body() body): Promise<Fmea | null> {
    return this.fmeaService.addColumn(id, body);
  }

  /**
   *
   * @param id for the FMEA
   * @returns
   */
  @Put(":id/row")
  async addRow(@Param("id") id: number): Promise<Fmea | null> {
    return this.fmeaService.addRow(id);
  }

  /**
   *
   * @param id FMEA ID
   * @param body contains row ID, column to be updated and updated cell value
   * @returns the updated FMEA object
   */
  @Put(":id/cell")
  async updateCell(@Param("id") id: number, @Body() body): Promise<Fmea> {
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
  ): Promise<Fmea | null> {
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
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteColumn(fmeaId, column);
  }

  @Delete(":fmeaid/:rowid/delete")
  async deleteRow(
    @Param("fmeaid") fmeaId: number,
    @Param("rowid") rowId: number,
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteRow(fmeaId, rowId);
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @returns
   */
  @Put(":id/delete")
  async deleteFmea(@Param("id") fmeaId: number): Promise<boolean | null> {
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
  ): Promise<Fmea | null> {
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
  ): Promise<Fmea | null> {
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
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnDetails(fmeaId, prev_column_name, body);
  }

  @Put(":id/addInitiator")
  async addInitiator(
    @Param("id") fmeaId: number,
    @Body() body,
  ): Promise<Fmea | null> {
    return this.fmeaService.addInitiator(fmeaId, String(body.initiatorId));
  }

  @Put(":id/deleteInitiator")
  async deleteInitiator(
    @Param("id") fmeaId: number,
    @Body() body: { initiatorId: string }, // Specify the type of initiatorId as string
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteInitiator(fmeaId, body.initiatorId);
  }
}
