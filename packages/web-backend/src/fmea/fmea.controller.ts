import { Controller, Post, Get, Put, Body, Param, Delete } from "@nestjs/common";
import { FmeaService } from "./fmea.service";
import { Fmea } from "./schemas/fmea.schema";
import { UpdateCellBody } from "./dtos/update-cell-body.dto";
import { UpdateDropdownBody } from "./dtos/update-dropdown-body.dto";
import { AddColumnBody } from "./dtos/add-column-body.dto";
import { UpdateColumnNameBody } from "./dtos/update-column-name-body.dto";
@Controller()
export class FmeaController {
  constructor(private readonly fmeaService: FmeaService) {}
  @Post()
  async createFmea(
    @Body()
    body,
  ): Promise<Fmea> {
    const createdFmea = this.fmeaService.createFmea(body);
    return createdFmea;
  }
  @Get("by-sa/:saId")
  async getFmeaBySa(
    @Param("saId")
    saId: number,
  ): Promise<Fmea[]> {
    return this.fmeaService.getFmeaBySaId(saId);
  }
  @Get(":id")
  async getFmea(
    @Param("id")
    id: number,
  ): Promise<Fmea | null> {
    return this.fmeaService.getFmeaById(id);
  }
  @Put(":id/column")
  async addColumn(
    @Param("id")
    id: number,
    @Body()
    body: AddColumnBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.addColumn(id, body);
  }
  @Put(":id/row")
  async addRow(
    @Param("id")
    id: number,
  ): Promise<Fmea | null> {
    return this.fmeaService.addRow(id);
  }
  @Put(":id/cell")
  async updateCell(
    @Param("id")
    id: number,
    @Body()
    body: UpdateCellBody,
  ): Promise<boolean> {
    return this.fmeaService.updateCell(id, body.rowId, body.column, body.value);
  }
  @Put(":id/dropdown")
  async updateDropdownOptions(
    @Param("id")
    id: number,
    @Body()
    body: UpdateDropdownBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateDropdownOptions(id, body.column, body.dropdownOptions);
  }
  @Put(":fmeaid/:column/delete")
  async deleteColumn(
    @Param("fmeaid")
    fmeaId: number,
    @Param("column")
    column: string,
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteColumn(fmeaId, column);
  }
  @Delete(":fmeaid/:rowid/delete")
  async deleteRow(
    @Param("fmeaid")
    fmeaId: number,
    @Param("rowid")
    rowId: string,
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteRow(fmeaId, rowId);
  }
  @Put(":id/delete")
  async deleteFmea(
    @Param("id")
    fmeaId: number,
  ): Promise<boolean | null> {
    return this.fmeaService.deleteFmea(fmeaId);
  }
  @Put(":id/column/updateName")
  async updateColumnName(
    @Param("id")
    id: number,
    @Body()
    body: UpdateColumnNameBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnName(id, body.column, body.newColumnName);
  }
  @Put(":id/column/updateType")
  async updateColumnType(
    @Param("id")
    id: number,
    @Body()
    body,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnType(id, body);
  }
  @Put(":id/:column/update")
  async updateColumn(
    @Param("id")
    fmeaId: number,
    @Param("column")
    prev_column_name: string,
    @Body()
    body: UpdateDropdownBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnDetails(fmeaId, prev_column_name, body);
  }
}
