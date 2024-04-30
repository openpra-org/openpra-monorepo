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

import { Public } from "../guards/public.guard";
import { CommentsService } from "./comments.service";
  
@Controller()
export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Get("/hello")
    getHello(): string {
        return "Hello";
    }
}


