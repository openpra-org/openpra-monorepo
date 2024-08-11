import { Controller, UseGuards, ConflictException, BadRequestException } from "@nestjs/common";
import { TypedBody, TypedHeaders, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { Pagination } from "shared-types/src/openpra-mef/collab/pagination";
import { NewUser } from "shared-types/src/openpra-mef/collab/new-user";
import { UserPreferences } from "shared-types/src/openpra-mef/collab/user-preferences";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { Public } from "../guards/public.guard";
import { CollabService } from "./collab.service";
import { User } from "./schemas/user.schema";

@Controller()
@UseGuards(JwtAuthGuard)
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  /**
   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
   * @param query Query string parameters
   * @returns List of all users
   * @example GET request -> https://staging.app.openpra.org/api/collab/user/
   * @example GET request -> https://staging.app.openpra.org/api/collab/user/?limit=10&offset=0
   */
  @TypedRoute.Get("/user/")
  public async getUsersList(
    @TypedHeaders() req: { originalUrl: string },
    @TypedQuery()
    query: {
      limit?: number;
      offset?: number;
      role?: string;
    },
  ): Promise<Pagination> {
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
  @TypedRoute.Post("/user/")
  public async createNewUser(@TypedBody() body: NewUser): Promise<User | string> {
    const newUser = await this.collabService.createNewUser(body);

    // Check if newUser is null, indicating duplicate username
    if (newUser === "username already exists") {
      // Handle the case where the user already exists, for example, return an appropriate response
      throw new ConflictException("Username already exists");
    }
    if (newUser === "email already exists") {
      // Handle the case where the user already exists, for example, return an appropriate response
      throw new BadRequestException("Email already exists");
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
  @TypedRoute.Post("/validateEmail/")
  public async isValidEmail(@TypedBody() body: { email: string }): Promise<boolean> {
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
  @TypedRoute.Post("/validateUsername/")
  public async isValidUsername(@TypedBody() body: { username: string }): Promise<boolean> {
    return await this.collabService.isUsernameValid(body.username);
  }

  /**
   * @param {string} user_id ID of the user
   * @returns {Type} Preferences of the user
   * @example GET request -> https://staging.app.openpra.org/api/collab/user/1/preferences/
   */
  @TypedRoute.Get("/user/:user_id/preferences/")
  public async getUserPreferences(@TypedParam("user_id") user_id: string) {
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
  @TypedRoute.Put("/user/:user_id/preferences/")
  public async updateUserPreferences(
    @TypedParam("user_id") user_id: string,
    @TypedBody() body: UserPreferences,
  ): Promise<void> {
    return this.collabService.updateUserPreferences(user_id, body);
  }

  /**
   * This endpoint fetches a particular user by ID
   * @param user_id - user ID of the member which you want to find
   */
  @TypedRoute.Get("/user/:user_id/")
  public async getUserById(@TypedParam("user_id") user_id: string): Promise<User> {
    return this.collabService.getUserById(user_id);
  }

  /**
   * This endpoint will update a user
   * @param body - The UpdateUserDto object which contains the id of the user to be updated and the updated details
   */
  @TypedRoute.Put("/user/:user_id/")
  public async updateUserById(@TypedBody() body: MemberResult): Promise<void> {
    await this.collabService.updateUser(body);
  }
}
