import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { InitiatingEventGroupService } from "./initiatingEventGroup.service";

@Controller()
export class InitiatingEventGroupController {
  constructor(
    private readonly initatingEventGroupService: InitiatingEventGroupService,
  ) {}

  /**
   * A simple hello world endpoint to check if the server is running
   */
  @Get("/hello/")
  helloWorld(): string {
    return "Hello World!";
  }

  /**
   * @returns all initiating event groups
   */
  @Get("/initiatingEventGroup/")
  async getInitiatingEventGroups(): Promise<any> {
    return this.initatingEventGroupService.getInitiatingEventGroups();
  }

  /**
   * @param id - the id of the initiating event group
   * @returns the initiating event group with the given id
   */
  @Get("/:id")
  async getInitiatingEventGroupById(@Param("id") id: string): Promise<any> {
    return this.initatingEventGroupService.getInitiatingEventGroupById(id);
  }

  /**
   * @param initiatingEventGroup - the initiating event group to be created
   * @returns the created initiating event group
   */
  @Post("/")
  async createInitiatingEventGroup(
    @Body() initiatingEventGroup: any,
  ): Promise<any> {
    return this.initatingEventGroupService.createInitiatingEventGroup(
      initiatingEventGroup,
    );
  }

  /**
   *
   * @param id - the id of the initiating event group to be updated
   * @param initiatingEventGroup - the updated initiating event group
   * @returns the updated initiating event group
   */
  @Put("/:id")
  async updateInitiatingEventGroup(
    @Param("id") id: string,
    @Body() initiatingEventGroup: any,
  ): Promise<any> {
    return this.initatingEventGroupService.updateInitiatingEventGroup(
      id,
      initiatingEventGroup,
    );
  }

  /**
   * @param id - the id of the initiating event group to be deleted
   * @returns the deleted initiating event group
   */
  @Delete("/:id")
  async deleteInitiatingEventGroup(@Param("id") id: string): Promise<any> {
    return this.initatingEventGroupService.deleteInitiatingEventGroup(id);
  }

  /**
   * @param eventId find the initiating event group with the given event id
   * @returns the initiating event group with the given event id
   */
  @Get("/event/:eventId")
  async getInitiatingEventGroupIdByEventId(
    @Param("eventId") eventId: string,
  ): Promise<any> {
    return this.initatingEventGroupService.getInitiatingEventGroupIdByEventId(
      eventId,
    );
  }

  /**
   * @param id - the id of the initiating event group to add the event to
   * @param eventId - the id of the event to be added to the initiating event group
   * @returns the updated initiating event group
   */
  @Put("/:id/addEvent/:eventId")
  async addInitiatingEventToGroup(
    @Param("id") id: string,
    @Param("eventId") eventId: string,
  ): Promise<any> {
    return this.initatingEventGroupService.addInitiatingEventToGroup(
      id,
      eventId,
    );
  }

  /**
   * @param id - the id of the initiating event group to remove the event from
   * @param eventId - the id of the event to be removed from the initiating event group
   * @returns the updated initiating event group
   */
  @Put("/:id/removeEvent/:eventId")
  async removeInitiatingEventFromGroup(
    @Param("id") id: string,
    @Param("eventId") eventId: string,
  ): Promise<any> {
    return this.initatingEventGroupService.removeInitiatingEventFromGroup(
      id,
      eventId,
    );
  }
}
