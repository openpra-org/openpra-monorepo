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
} from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { Public } from "../guards/public.guard";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { CollabService } from "./collab.service";
import { CreateNewUserDto } from "./dtos/create-new-user.dto";
import { PaginationDto } from "./dtos/pagination.dto";
import { UserPreferencesDto } from "./dtos/user-preferences.dto";
import { HclModel } from "../hcl/schemas/hcl-model.schema";
import { User } from "./schemas/user.schema";

@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(InvalidTokenFilter)
export class CollabController {
  constructor(private collabService: CollabService) {}

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
    @Query() query: { limit?: any; offset?: any },
  ): Promise<PaginationDto> {
    if (query.limit && query.offset) {
      return this.collabService.getUsersList(
        req.originalUrl,
        query.limit,
        query.offset,
      );
    }
    return this.collabService.getUsersList(
      req.originalUrl,
      undefined,
      undefined,
    );
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
  async createNewUser(@Body() body: CreateNewUserDto): Promise<User> {
    return this.collabService.createNewUser(body);
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
  async updateUserPreferences(
    @Param("user_id") user_id: string,
    @Body() body: UserPreferencesDto,
  ) {
    return this.collabService.updateUserPreferences(user_id, body);
  }
}
