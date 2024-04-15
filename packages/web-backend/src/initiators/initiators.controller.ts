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
  
@Controller()
export class InitiatorController {
constructor(private readonly initiatorService: InitiatorService) {}
    @Get("/hello/")
    async helloWorld(): Promise<string> {
        return "Hello World!";
    }
}
