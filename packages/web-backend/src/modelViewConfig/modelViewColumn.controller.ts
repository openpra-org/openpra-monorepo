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
}
