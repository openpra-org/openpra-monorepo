import {
  HttpStatus,
  Controller,
  Get,
  Post,
  Put,
  Request as NestRequest,
  Param,
  Query,
  Body,
  UseFilters,
  UseGuards,
  HttpException,
} from "@nestjs/common";
import type { Request } from "express";
import { MemberResult, EmailValidationForm, UsernameValidationForm } from "shared-sdk";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { Public } from "../guards/public.guard";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { CreateNewUserSchemaDto } from "./dtos/createNewUser-schema";
import { CollabService } from "./collab.service";
import { PaginationDto } from "./dtos/pagination.dto";
import { UserPreferencesDto } from "./dtos/user-preferences.dto";
import { User } from "./schemas/user.schema";
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(InvalidTokenFilter)
export class CollabController {
  constructor(private readonly collabService: CollabService) {}
  @Get("/user/")
  async getUsersList(
    @NestRequest()
    req: Request,
    @Query()
    query: {
      limit?: number;
      offset?: number;
      role?: string;
    },
  ): Promise<PaginationDto> {
    const originalUrl: string = typeof req.originalUrl === "string" ? req.originalUrl : String(req.originalUrl ?? "");
    if (query.limit && query.offset) {
      return this.collabService.getUsersList(originalUrl, query.limit, query.offset, query.role);
    }
    return this.collabService.getUsersList(originalUrl, undefined, undefined, query.role);
  }
  @Public()
  @Post("/user/")
  async createNewUser(
    @Body()
    body: CreateNewUserSchemaDto,
  ): Promise<User | string> {
    const newUser = await this.collabService.createNewUser(body);
    if (newUser === "username already exists") {
      throw new HttpException("Username already exists", HttpStatus.CONFLICT);
    }
    if (newUser === "email already exists") {
      throw new HttpException("Email already exists", HttpStatus.BAD_REQUEST);
    }
    return newUser;
  }
  @Public()
  @Post("/validateEmail/")
  async isValidEmail(
    @Body()
    body: EmailValidationForm,
  ): Promise<boolean> {
    return await this.collabService.isEmailValid(body.email);
  }
  @Public()
  @Post("/validateUsername/")
  async isValidUsername(
    @Body()
    body: UsernameValidationForm,
  ): Promise<boolean> {
    return await this.collabService.isUsernameValid(body.username);
  }
  @Get("/user/:user_id/preferences/")
  async getUserPreferences(
    @Param("user_id")
    user_id: string,
  ) {
    return this.collabService.getUserPreferences(user_id);
  }
  @Put("/user/:user_id/preferences/")
  async updateUserPreferences(
    @Param("user_id")
    user_id: string,
    @Body()
    body: UserPreferencesDto,
  ) {
    return this.collabService.updateUserPreferences(user_id, body);
  }
  @Get("/user/:user_id/")
  async getUserById(
    @Param("user_id")
    user_id: string,
  ): Promise<User> {
    return this.collabService.getUserById(user_id);
  }
  @Put("/user/:user_id/")
  async updateUserById(
    @Body()
    body: MemberResult,
  ): Promise<void> {
    await this.collabService.updateUser(body);
  }
}
