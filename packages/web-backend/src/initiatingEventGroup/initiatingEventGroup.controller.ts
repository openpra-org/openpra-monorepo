import {
    HttpStatus,
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Request,
    Param,
    Query,
    Body,
    UseFilters,
    UseGuards,
    HttpException,
} from "@nestjs/common";
import { InitiatingEventGroupService } from "./initiatingEventGroup.service";

@Controller()
export class InitiatingEventGroupController {
constructor(private readonly initatingEventGroupService: InitiatingEventGroupService) {}
    @Get("/hello/")
    async helloWorld(): Promise<string> {
        return "Hello World!";
    }
    
    @Get("/initiatingEventGroup/")
    async getInitiatingEventGroups(): Promise<any> {
        return this.initatingEventGroupService.getInitiatingEventGroups();
    }

    @Get("/:id")
    async getInitiatingEventGroupById(@Param("id") id: string): Promise<any> {
        return this.initatingEventGroupService.getInitiatingEventGroupById(id);
    }

    @Post("/")
    async createInitiatingEventGroup(@Body() initiatingEventGroup: any): Promise<any> {
        return this.initatingEventGroupService.createInitiatingEventGroup(initiatingEventGroup);
    }

    @Put("/:id")
    async updateInitiatingEventGroup(@Param("id") id: string, @Body() initiatingEventGroup: any): Promise<any> {
        return this.initatingEventGroupService.updateInitiatingEventGroup(id, initiatingEventGroup);
    }

    @Delete("/:id")
    async deleteInitiatingEventGroup(@Param("id") id: string): Promise<any> {
        return this.initatingEventGroupService.deleteInitiatingEventGroup(id);
    }

    @Get("/event/:eventId")
    async getInitiatingEventGroupIdByEventId(@Param("eventId") eventId: string): Promise<any> {
        return this.initatingEventGroupService.getInitiatingEventGroupIdByEventId(eventId);
    }

    @Put("/:id/addEvent/:eventId")
    async addInitiatingEventToGroup(@Param("id") id: string, @Param("eventId") eventId: string): Promise<any> {
        return this.initatingEventGroupService.addInitiatingEventToGroup(id, eventId);
    }

    @Put("/:id/removeEvent/:eventId")
    async removeInitiatingEventFromGroup(@Param("id") id: string, @Param("eventId") eventId: string): Promise<any> {
        return this.initatingEventGroupService.removeInitiatingEventFromGroup(id, eventId);
    }
}
