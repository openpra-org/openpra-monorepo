import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { FmeaService } from './fmea.service';
import { Fmea } from './schemas/fmea.schema';
import { UpdateCellBody } from './dtos/update-cell-body.dto';
import { UpdateDropdownBody } from './dtos/update-dropdown-body.dto';
import { AddColumnBody } from './dtos/add-column-body.dto';
import { UpdateColumnNameBody } from './dtos/update-column-name-body.dto';

/**
 * Controller for FMEA operations.
 * Provides endpoints to create, update, and manage FMEA tables.
 * @public
 */
@Controller()
export class FmeaController {
  /**
   * Instantiate the FMEA controller.
   *
   * @param fmeaService - Service providing FMEA domain operations.
   */
  constructor(private readonly fmeaService: FmeaService) {}

  /**
   * Create a new FMEA.
   *
   * @param body - Request body containing initial FMEA fields
   * @returns Created FMEA object
   */
  @Post()
  async createFmea(@Body() body): Promise<Fmea> {
    const createdFmea = this.fmeaService.createFmea(body);
    return createdFmea;
  }

  /**
   * Get a specific FMEA.
   *
   * @param id - FMEA ID
   * @returns The FMEA object, if found
   */
  @Get(':id')
  async getFmea(@Param('id') id: number): Promise<Fmea | null> {
    return this.fmeaService.getFmeaById(id);
  }

  /**
   * Add a column to an FMEA. If the column type is "string" then dropdown options can be empty or omitted.
   *
   * @param id - FMEA ID
   * @param body - Contains column name, type, and optional dropdown options
   * @returns Updated FMEA
   */
  @Put(':id/column')
  async addColumn(
    @Param('id') id: number,
    @Body() body: AddColumnBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.addColumn(id, body);
  }

  /**
   * Add a new row to an FMEA.
   *
   * @param id - FMEA ID
   * @returns Updated FMEA
   */
  @Put(':id/row')
  async addRow(@Param('id') id: number): Promise<Fmea | null> {
    return this.fmeaService.addRow(id);
  }

  /**
   * Update a specific cell value in a row.
   *
   * @param id - FMEA ID
   * @param body - Contains row ID, column to be updated, and the new cell value
   * @returns Whether the cell was updated
   */
  @Put(':id/cell')
  async updateCell(
    @Param('id') id: number,
    @Body() body: UpdateCellBody,
  ): Promise<boolean> {
    return this.fmeaService.updateCell(id, body.rowId, body.column, body.value);
  }

  /**
   * Update dropdown options for a column.
   *
   * @param id - FMEA ID
   * @param body - Contains column name and dropdown options
   * @returns Updated FMEA object
   */
  @Put(':id/dropdown')
  async updateDropdownOptions(
    @Param('id') id: number,
    @Body() body: UpdateDropdownBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateDropdownOptions(
      id,
      body.column,
      body.dropdownOptions,
    );
  }

  /**
   * Delete a column from an FMEA.
   *
   * @param fmeaId - FMEA ID
   * @param column - Column to be deleted
   * @returns Updated FMEA
   */
  @Put(':fmeaid/:column/delete')
  async deleteColumn(
    @Param('fmeaid') fmeaId: number,
    @Param('column') column: string,
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteColumn(fmeaId, column);
  }

  /**
   * Delete a row from an FMEA.
   *
   * @param fmeaId - FMEA ID
   * @param rowId - The row identifier to delete
   * @returns Updated FMEA after deletion, or null if not found
   */
  @Delete(':fmeaid/:rowid/delete')
  async deleteRow(
    @Param('fmeaid') fmeaId: number,
    @Param('rowid') rowId: string,
  ): Promise<Fmea | null> {
    return this.fmeaService.deleteRow(fmeaId, rowId);
  }

  /**
   * Delete an FMEA.
   *
   * @param fmeaId - FMEA ID
   * @returns Whether the FMEA was deleted
   */
  @Put(':id/delete')
  async deleteFmea(@Param('id') fmeaId: number): Promise<boolean | null> {
    return this.fmeaService.deleteFmea(fmeaId);
  }

  /**
   * Update a column's display name.
   *
   * @param id - FMEA ID
   * @param body - Contains current column name and the new column name
   * @returns Updated FMEA
   */
  @Put(':id/column/updateName')
  async updateColumnName(
    @Param('id') id: number,
    @Body() body: UpdateColumnNameBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnName(
      id,
      body.column,
      body.newColumnName,
    );
  }

  /**
   * Update a column's type (and options for dropdown type).
   *
   * @param id - FMEA ID
   * @param body - Contains old/new column info, dropdown options, and type
   * @returns Updated FMEA
   */
  @Put(':id/column/updateType')
  async updateColumnType(
    @Param('id') id: number,
    @Body() body,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnType(id, body);
  }

  /**
   * Update column details.
   *
   * @param fmeaId - The FMEA id
   * @param prev_column_name - The current column name
   * @param body - New column name, type, and dropdown options
   * @returns Updated FMEA
   */
  @Put(':id/:column/update')
  async updateColumn(
    @Param('id') fmeaId: number,
    @Param('column') prev_column_name: string,
    @Body() body: UpdateDropdownBody,
  ): Promise<Fmea | null> {
    return this.fmeaService.updateColumnDetails(fmeaId, prev_column_name, body);
  }
}
