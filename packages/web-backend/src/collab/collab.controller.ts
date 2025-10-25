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

  /**
  * Retrieve a paginated list of users.
  *
  * @param req - Express request object. See {@link https://expressjs.com/en/api.html#req}.
  * @param query - Query string parameters.
  * @returns List of all users
  * @example
  * GET request: https://staging.app.openpra.org/api/collab/user/
  * @example
  * GET request with pagination: https://staging.app.openpra.org/api/collab/user/?limit=10&offset=0
   */
  @Get("/user/")
  async getUsersList(
    @NestRequest() req: Request,
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

  /**
   * Create a new user in the system.
   *
   * @param body - Request body containing new user fields.
   * @example
  * Request body sample:
  * \{
  *   "first_name": "Edward",
  *   "last_name": "Elric",
  *   "email": "fullmetal_alchemist\@gmail.com",
   *   "username": "Ed",
   *   "password": "WinryRockbell"
   * \}
   * @returns A mongoose document of the new user
   * @example
   * POST request: https://staging.app.openpra.org/api/collab/user/
   */
  @Public()
  @Post("/user/")
  async createNewUser(@Body() body: CreateNewUserSchemaDto): Promise<User | string> {
    const newUser = await this.collabService.createNewUser(body);

    // Check if newUser is null, indicating duplicate username
    if (newUser === "username already exists") {
      // Handle the case where the user already exists, for example, return an appropriate response
      throw new HttpException("Username already exists", HttpStatus.CONFLICT);
    }
    if (newUser === "email already exists") {
      // Handle the case where the user already exists, for example, return an appropriate response
      throw new HttpException("Email already exists", HttpStatus.BAD_REQUEST);
    }

    // User creation was successful, return the new user
    return newUser;
  }

  /**
   * Check whether an email address is unique.
   *
   * @param body - The request body containing the email to validate.
   * @example
  * Request body example: \{ "email": "xyz\@gmail.com" \}
   */
  @Public()
  @Post("/validateEmail/")
  async isValidEmail(@Body() body: EmailValidationForm): Promise<boolean> {
    return await this.collabService.isEmailValid(body.email);
  }

  /**
   * Check whether a username is unique.
   *
   * @param body - The request body containing the username to validate.
   * @example
  * Request body example: \{ "username": "sampleUsername123" \}
   */
  @Public()
  @Post("/validateUsername/")
  async isValidUsername(@Body() body: UsernameValidationForm): Promise<boolean> {
    return await this.collabService.isUsernameValid(body.username);
  }

  /**
   * Get preferences for a user.
   *
   * @param user_id - ID of the user
   * @returns Preferences of the user
   * @example
   * GET request: https://staging.app.openpra.org/api/collab/user/1/preferences/
   */
  @Get("/user/:user_id/preferences/")
  async getUserPreferences(@Param("user_id") user_id: string) {
    return this.collabService.getUserPreferences(user_id);
  }

  /**
   * Update preferences for a user.
   *
   * @param user_id - ID of the user
   * @param body - Request body containing the updated preferences.
  * @example
  * Request body sample:
  *
  * ```json
  * {
  *   "preferences": {
  *     "theme": "Light",
  *     "nodeIdsVisible": false,
  *     "outlineVisible": false,
  *     "node_value_visible": true,
  *     "nodeDescriptionEnabled": true,
  *     "pageBreaksVisible": false
  *   }
  * }
  * ```
   * @returns Updated preferences of the user
   * @example
   * PUT request: https://staging.app.openpra.org/api/collab/user/1/preferences/
   */
  @Put("/user/:user_id/preferences/")
  async updateUserPreferences(@Param("user_id") user_id: string, @Body() body: UserPreferencesDto) {
    return this.collabService.updateUserPreferences(user_id, body);
  }

  /**
   * Fetch a particular user by ID.
   *
   * @param user_id - User ID of the member to find
   */
  @Get("/user/:user_id/")
  async getUserById(@Param("user_id") user_id: string): Promise<User> {
    return this.collabService.getUserById(user_id);
  }

  /**
   * Update a user with the provided details.
   *
   * @param body - The UpdateUserDto object which contains the id of the user to be updated and the updated details
   */
  @Put("/user/:user_id/")
  async updateUserById(@Body() body: MemberResult): Promise<void> {
    await this.collabService.updateUser(body);
  }
}
