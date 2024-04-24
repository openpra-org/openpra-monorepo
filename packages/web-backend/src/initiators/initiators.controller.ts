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
import { MemberResult } from "shared-types/src/lib/api/Members";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { Public } from "../guards/public.guard";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { InitiatorService } from "./initiators.service";
import { Initiator } from "./schemas/initiator.schema";
  
@Controller()
export class InitiatorController {
constructor(private readonly initiatorService: InitiatorService) {}
    @Get("/hello/")
    async helloWorld(): Promise<string> {
        return "Hello World!";
    }

    //get all initiators
    @Get("/initiators/")
    async getAllInitiators(): Promise<Initiator[]> {
        return this.initiatorService.getAllInitiators();
    }

    //get initiator by id
    @Get("/initiator/:id")
    async getInitiatorById(@Param("id") id: string): Promise<Initiator | null> {
        return this.initiatorService.getInitiatorById(id);
    }

    //create new initiator
    @Post("/initiator/")
    async createInitiator(@Body() initiator: Initiator): Promise<Initiator> {
        return this.initiatorService.createInitiator(initiator);
    }

    //update initiator by id
    @Put("/initiator/:id")
    async updateInitiator(@Param("id") id: string, @Body() initiator: Initiator): Promise<Initiator | null> {
        return this.initiatorService.updateInitiator(id, initiator);
    }

    //delete initiator by id
    @Delete("/initiator/:id")
    async deleteInitiator(@Param("id") id: string): Promise<Initiator | null> {
        return this.initiatorService.deleteInitiator(id);
    }
}
