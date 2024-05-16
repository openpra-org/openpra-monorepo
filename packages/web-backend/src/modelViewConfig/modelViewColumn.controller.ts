import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { ModelViewColumnService } from "./modelViewColumn.service";


@Controller()
export class ModelViewColumnController {
  constructor(private readonly modelViewColumnService: ModelViewColumnService) {}

  /**
   * A simple hello world endpoint to check if the server is running
   */
  @Get("/hello/")
  helloWorld(): string {
    return "Hello World!";
  }

  /**
   * 
   * @param column - The column to be added
   * @returns - The added column
   */
  @Put("/addColumn/")
  async addColumn(@Body() column) {
    console.log("Create column using",column)
    return await this.modelViewColumnService.addColumn(column);
  }

  /**
   * 
   * @param column - The column to be deleted
   * @returns - The deleted column
   */
  @Put("/deleteColumn/")
  async deleteColumn(@Body() column) {
    return await this.modelViewColumnService.deleteColumn(column.name);
  }

  /**
   * 
   * @param columnName - The name of the column to be updated
   * @param column - The updated column object
   * @returns - The updated column
   */
  @Put("/updateColumn/:columnName/")
  async updateColumn( @Param("columnName") columnName: string ,@Body() column) {
    return await this.modelViewColumnService.updateColumn(columnName,column);
  }
}
