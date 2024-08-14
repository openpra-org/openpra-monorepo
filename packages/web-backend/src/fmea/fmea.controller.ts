import { Controller, HttpStatus } from "@nestjs/common";
import { TypedBody, TypedParam, TypedRoute } from "@nestia/core";
import { DropdownOption } from "shared-types/src/openpra-mef/fmea/fmea";
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
  @TypedRoute.Post()
  public async createFmea(@TypedBody() body: { title: string; description: string }): Promise<Fmea> {
    return this.fmeaService.createFmea(body);
  }

  /**
   *
   * @param id FMEA ID
   * @returns the FMEA object
   */
  @TypedRoute.Get(":id")
  public async getFmea(@TypedParam("id") id: number): Promise<Fmea | null> {
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
  @TypedRoute.Put(":id/column")
  public async addColumn(
    @TypedParam("id") id: number,
    @TypedBody() body: { name: string; type: string; dropdownOptions?: DropdownOption[] },
  ): Promise<Fmea | null> {
    return this.fmeaService.addColumn(id, body);
  }

  /**
   *
   * @param id for the FMEA
   * @returns
   */
  @TypedRoute.Put(":id/row")
  public async addRow(@TypedParam("id") id: number): Promise<Fmea | null> {
    return this.fmeaService.addRow(id);
  }

  /**
   *
   * @param id FMEA ID
   * @param body contains row ID, column to be updated and updated cell value
   * @returns the updated FMEA object
   */
  @TypedRoute.Put(":id/cell")
  public async updateCell(
    @TypedParam("id") id: number,
    @TypedBody() body: { rowId: number; column: string; value: string },
  ): Promise<Fmea | null> {
    return this.fmeaService.updateCell(id, body.rowId, body.column, body.value);
  }

  /**
   *
   * @param id the FMEA ID
   * @param body contains column name and dropdownoptions
   * @returns updated FMEA object
   */
  @TypedRoute.Put(":id/dropdown")
  public async updateDropdownOptions(
    @TypedParam("id") id: number,
    @TypedBody() body: { column: string; dropdownOptions: DropdownOption[] },
  ): Promise<Fmea | null> {
    return this.fmeaService.updateDropdownOptions(id, body.column, body.dropdownOptions);
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @param column the column to be deleted
   * @returns
   */
  @TypedRoute.Put(":fmeaid/:column/delete")
  public async deleteColumn(
    @TypedParam("fmeaid") fmeaId: number,
    @TypedParam("column") column: string,
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteColumn(fmeaId, column);
  }

  @TypedRoute.Delete(":fmeaid/:rowid/delete")
  public async deleteRow(
    @TypedParam("fmeaid") fmeaId: number,
    @TypedParam("rowid") rowId: number,
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteRow(fmeaId, rowId);
  }

  /**
   *
   * @param fmeaId the FMEA ID
   * @returns
   */
  @TypedRoute.Put(":id/delete")
  public async deleteFmea(@TypedParam("id") fmeaId: number): Promise<HttpStatus | null> {
    return this.fmeaService.deleteFmea(fmeaId);
  }

  /**
   *
   * @param id the FMEA ID
   * @param body contains column name and new column name
   * @returns
   */
  @TypedRoute.Put(":id/column/updateName")
  public async updateColumnName(
    @TypedParam("id") id: number,
    @TypedBody() body: { column: string; newColumnName: string },
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnName(id, body.column, body.newColumnName);
  }

  /**
   *
   * @param id the FMEA ID
   * @param body oldColumn: column name, newColumn: new column name, dropdownOptions: sdropdown options, type: type of new column
   * @returns
   */
  @TypedRoute.Put(":id/column/updateType")
  public async updateColumnType(
    @TypedParam("id") id: number,
    @TypedBody() body: { id: number; name: string; type: string; dropdownOptions: DropdownOption[] },
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnType(id, body);
  }

  /**
   * @param fmeaId
   * @param prev_column_name
   * @param body contains new column name, type of column, dropdown options
   * @returns
   */
  @TypedRoute.Put(":id/:column/update")
  public async updateColumn(
    @TypedParam("id") fmeaId: number,
    @TypedParam("column") prev_column_name: string,
    @TypedBody() body: { id: number; name: string; type: string; dropdownOptions: DropdownOption[] },
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnDetails(fmeaId, prev_column_name, body);
  }
}
