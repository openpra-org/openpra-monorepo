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
import {Initiator} from "../initiators/schemas/initiator.schema";
import {Comments} from "./schemas/comments.schema";

@Controller()
export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Get("/hello")
    async getHello(): Promise<string> {
        return "Hello";
    }

  @Get("/comments/")
  async getAllComments(associated_with: string): Promise<Comments[]> {
    return this.commentsService.getAllComments(associated_with);
  }

  @Get("/comments/:associated_with/:id")
  async getCommentsById(@Param("associated_with") associated_with: string, @Param("id") id: string): Promise<Comments | null> {
    return this.commentsService.getCommentsById(associated_with, id);
  }

  @Post("/comments/")
  async createComments(@Body() comment: Comments): Promise<Comments> {
    return this.commentsService.createComments(comment);
  }
}


