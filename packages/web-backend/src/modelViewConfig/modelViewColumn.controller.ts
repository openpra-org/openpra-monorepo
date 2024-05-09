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

  @Put("/addColumn/")
  async addColumn(@Body() column) {
    console.log("Create column using",column)
    return await this.modelViewColumnService.addColumn(column);
  }

  @Put("/deleteColumn/")
  async deleteColumn(@Body() column) {
    return await this.modelViewColumnService.deleteColumn(column.name);
  }

  @Put("/updateColumn/:columnName/")
  async updateColumn( @Param("columnName") columnName: string ,@Body() column) {
    return await this.modelViewColumnService.updateColumn(columnName,column);
  }
}
