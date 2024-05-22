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
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { MemberResult } from "shared-types/src/lib/api/Members";

import { Public } from "../guards/public.guard";
import { CommentsService } from "./comments.service";
import { Initiator } from "../initiators/schemas/initiator.schema";
import { Comments } from "./schemas/comments.schema";
import { v4 as uuidv4 } from "uuid";

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get("/hello")
  async getHello(): Promise<string> {
    return "Hello";
  }

  @Get("/comments/:associated_with")
  async getAllComments(
    @Param("associated_with") associated_with: string,
  ): Promise<Comments[] | null> {
    return this.commentsService.getAllComments(associated_with);
  }

  @Get("/comments/:associated_with/:id")
  async getCommentsById(
    @Param("associated_with") associated_with: string,
    @Param("id") id: string,
  ): Promise<Comments | null> {
    return this.commentsService.getCommentsById(associated_with, id);
  }

  @Post("/comments/")
  async createComments(@Body() comment: Comments): Promise<Comments> {
    return this.commentsService.createComments(comment);
  }

  @Put("/comments/update/:associated_with/:id")
  async updateComment(
    @Param("associated_with") associated_with: string,
    @Param("id") id: string,
    @Body() comment: Comments,
  ): Promise<Comments | null> {
    return this.commentsService.updateCommentById(id, associated_with, comment);
  }

  @Delete("/comments/delete/:associated_with/:id")
  async deleteCommentById(
    @Param("associated_with") associated_with: string,
    @Param("id") id: string,
  ): Promise<Comments | null> {
    return this.commentsService.deleteComment(associated_with, id);
  }

  // @Delete("/comments/delete/all/:associated_with")
  // async deleteAllComments(
  //   @Param("associated_with") associated_with: string,
  // ): Promise<{ deletedCount: number }> {
  //   try {
  //     const deletedCount =
  //       await this.commentsService.deleteCommentsByAssociatedId(
  //         associated_with,
  //       );
  //     return { deletedCount };
  //   } catch (error) {
  //     throw new HttpException(
  //       "Failed to delete comments",
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }
}
