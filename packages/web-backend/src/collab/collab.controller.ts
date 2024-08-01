import {
  HttpStatus,
  Controller,
  Get,
  Post,
  Put,
  Request,
  Param,
  Query,
  Body,
  UseFilters,
  UseGuards,
  HttpException,
} from "@nestjs/common";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { EmailValidationForm, UsernameValidationForm } from "shared-types/src/lib/api/FormValidation";
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
   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
   * @param query Query string parameters
   * @returns List of all users
   * @example GET request -> https://staging.app.openpra.org/api/collab/user/
   * @example GET request -> https://staging.app.openpra.org/api/collab/user/?limit=10&offset=0
   */
  @Get("/user/")
  async getUsersList(
    @Request() req,
    @Query()
    query: {
      limit?: number;
      offset?: number;
      role?: string;
    },
  ): Promise<PaginationDto> {
    if (query.limit && query.offset) {
      return this.collabService.getUsersList(req.originalUrl, query.limit, query.offset, query.role);
    }
    return this.collabService.getUsersList(req.originalUrl, undefined, undefined, query.role);
  }

  /**
   * @param body Request body
   * @example Request body sample:
   * {
   *   "first_name":"Edward",
   *   "last_name":"Elric",
   *   "email":"fullmetal_alchemist@gmail.com",
   *   "username":"Ed",
   *   "password":"WinryRockbell"
   * }
   * @returns A mongoose document of the new user
   * @example POST request -> https://staging.app.openpra.org/api/collab/user/
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
   * This endpoint will query the database and return true if user's email is unqiue
   * @param body - The request body
   * @example Request Body Example
   * {
   *   email : "xyz@gmail.com"
   * }
   */
  @Public()
  @Post("/validateEmail/")
  async isValidEmail(@Body() body: EmailValidationForm): Promise<boolean> {
    return await this.collabService.isEmailValid(body.email);
  }

  /**
   * This endpoint will query the database and return true if user's username is unqiue
   * @param body - The request body
   * @example Request Body Example
   * {
   *   username : "sampleUsername123"
   * }
   */
  @Public()
  @Post("/validateUsername/")
  async isValidUsername(@Body() body: UsernameValidationForm): Promise<boolean> {
    return await this.collabService.isUsernameValid(body.username);
  }

  /**
   * @param {string} user_id ID of the user
   * @returns {Type} Preferences of the user
   * @example GET request -> https://staging.app.openpra.org/api/collab/user/1/preferences/
   */
  @Get("/user/:user_id/preferences/")
  async getUserPreferences(@Param("user_id") user_id: string) {
    return this.collabService.getUserPreferences(user_id);
  }

  /**
   * @param {string} user_id ID of the user
   * @param body Request body
   * @example Request body sample:
   * {
   *   "preferences":
   *     {
   *       "theme": "Light",
   *       "nodeIdsVisible": false,
   *       "outlineVisible": false,
   *       "node_value_visible": true,
   *       "nodeDescriptionEnabled": true,
   *       "pageBreaksVisible": false
   *     }
   * }
   * @returns Updated preferences of the user
   * @example PUT Request -> https://staging.app.openpra.org/api/collab/user/1/preferences/
   */
  @Put("/user/:user_id/preferences/")
  async updateUserPreferences(@Param("user_id") user_id: string, @Body() body: UserPreferencesDto) {
    return this.collabService.updateUserPreferences(user_id, body);
  }

  /**
   * This endpoint fetches a particular user by ID
   * @param user_id - user ID of the member which you want to find
   */
  @Get("/user/:user_id/")
  async getUserById(@Param("user_id") user_id: string): Promise<User> {
    return this.collabService.getUserById(user_id);
  }

  /**
   * This endpoint will update a user
   * @param body - The UpdateUserDto object which contains the id of the user to be updated and the updated details
   */
  @Put("/user/:user_id/")
  async updateUserById(@Body() body: MemberResult): Promise<void> {
    await this.collabService.updateUser(body);
  }
}
