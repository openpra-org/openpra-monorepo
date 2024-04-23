import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { InitiatorService } from "./initiators.service";
import { Initiator } from "./schemas/initiator.schema";

@Controller()
export class InitiatorController {
  constructor(private readonly initiatorService: InitiatorService) {}

  /**
   * A simple hello world endpoint to check if the server is running
   */
  @Get("/hello/")
  helloWorld(): string {
    return "Hello World!";
  }

  /**
   * @returns all initiators
   */
  @Get("/initiators/")
  async getAllInitiators(): Promise<Initiator[]> {
    return this.initiatorService.getAllInitiators();
  }

  /**
   * @param id - the id of the initiator
   * @returns - the initiator with the given id
   */
  @Get("/initiator/:id")
  async getInitiatorById(@Param("id") id: string): Promise<Initiator | null> {
    return this.initiatorService.getInitiatorById(id);
  }

  /**
   * @param initiator - the initiator to be created
   * @returns the created initiator
   */
  @Post("/initiator/")
  async createInitiator(@Body() initiator: Initiator): Promise<Initiator> {
    return this.initiatorService.createInitiator(initiator);
  }

  /**
   * @param id - the id of the initiator to be updated
   * @param initiator - the updated initiator
   * @returns the updated initiator
   */
  @Put("/initiator/:id")
  async updateInitiator(
    @Param("id") id: string,
    @Body() initiator: Initiator,
  ): Promise<Initiator | null> {
    return this.initiatorService.updateInitiator(id, initiator);
  }

  /**
   * @param id - the id of the initiator to be deleted
   * @returns the deleted initiator
   */
  @Delete("/initiator/:id")
  async deleteInitiator(@Param("id") id: string): Promise<Initiator | null> {
    return this.initiatorService.deleteInitiator(id);
  }
}
