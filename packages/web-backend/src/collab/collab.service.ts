import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as argon2 from "argon2";
import * as dot from "dot-object";
// Note: updateOne returns UpdateResult, but callers don't use the return value
import { MemberResult } from "shared-sdk";
import { CreateNewUserSchemaDto } from "./dtos/createNewUser-schema";
import { PaginationDto } from "./dtos/pagination.dto";
import { UserPreferencesDto } from "./dtos/user-preferences.dto";
import { UserCounter, UserCounterDocument } from "./schemas/user-counter.schema";
import { User, UserDocument } from "./schemas/user.schema";

/**
 * Service for collaboration and user management.
 * Provides user CRUD, validation, and pagination helpers.
 * @public
 */
@Injectable()
export class CollabService {
  /**
   * Construct the collaboration service with persistence models.
   * @param userCounterModel - Mongoose model for tracking incremental user IDs.
   * @param userModel - Mongoose model for user documents.
   */
  constructor(
    //private hclService: HclService,
    @InjectModel(UserCounter.name)
    private readonly userCounterModel: Model<UserCounterDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Assists the Local Strategy method to determine whether a user exists in the database or not.
   *
   * @param username - Username of the user
   * @returns A mongoose document of the user or undefined
   */
  async loginUser(username: string): Promise<User | undefined> {
    return this.userModel.findOne({ username }).lean();
  }

  /**
   * After each login, update the last login time for the user.
   *
   * @param user_id - Current user's ID
   * @returns void
   */
  async updateLastLogin(user_id: number): Promise<void> {
    await this.userModel.updateOne({ id: user_id }, { last_login: Date.now() });
  }

  /**
   * Generate an ID for a newly created user in incremental order. If no user exists yet, IDs start at 1.
   *
   * @param name - Name of the counter
   * @returns ID number
   */
  async getNextUserValue(name: string): Promise<number> {
    const record = await this.userCounterModel.findByIdAndUpdate(
      name,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return record.seq;
  }

  /**
   * The pagination() method follows a very simple mechanism:
   *   1. It determines the number of pages its going to take to show all the queried results.
   *   2. It determines on which page the user is currently on.
   * These 2 parameters are calculated using 3 pieces of information: limit, offset and total number of results (count).
   * By default the limit = 10 and offset = 0. If the user provides different values, they replace the defaults.
   * Let's look at an example: let's say there are 35 users in the database. The current user is trying to see the list of users. The user set the
   * limit to 5 and offset to 10.
   * So, the number of pages required = (number of users / users per page) = (35 / 5) = 7 pages.
   * The current page = (skipped users / users per page) + 1 = (10 / 5) + 1 = 3.
   * After determining these values, the method will handle 4 situations:
   *   1. There's only 1 page in total where all the results fit; in that case there will be no previous or next page link.
   *   2. There's more than 1 page in total but the user is on the first result page; in that case - link for the next page will be available only.
   *   3. There's more than 1 page in total but the user is on the last result page; in that case - link for the previous page will be available only.
   *   4. There's more than 1 page in total and the user is somewhere between the first and last page; in that case links for both previous and next page will be available.
   * The 4th condition suits the above example. The user is on the 3rd page. The pagination() method
   * will provide links to the 2nd (previous) and 4th (next) pages.
   * @param count - Total number of results
   * @param url - Original request URL. See {@link https://expressjs.com/en/api.html#req.originalUrl}
   * @param limit - How many results can be seen at once
   * @param offset - How many initial results will be skipped
   * @returns The previous/next links and the active limit/offset values
   */
  pagination(
    count: number,
    url: string,
    limit?: unknown,
    offset?: unknown,
  ): { previous: string | null; next: string | null; default_limit: number; default_offset: number } {
    let previous: string | null = null;
    let next: string | null = null;
    const regex = /limit=[A-Za-z0-9]+&offset=[A-Za-z0-9]+/i;

    let default_limit: number = 10;
    let default_offset: number = 0;
    if (limit != null && offset != null) {
      const limitNum = typeof limit === "number" ? limit : Number(limit);
      const offsetNum = typeof offset === "number" ? offset : Number(offset);
      if (!Number.isNaN(limitNum)) {
        default_limit = limitNum;
      }
      if (!Number.isNaN(offsetNum)) {
        default_offset = offsetNum;
      }
    }

    const total_page = Math.ceil(count / default_limit);
    const current_page = default_offset / default_limit + 1;

    if (total_page <= 1) {
      return { previous, next, default_limit, default_offset };
    } else if (current_page === 1 && total_page > 1) {
      if (url.includes("limit")) {
        next = url.replace(regex, `limit=${default_limit}&offset=${default_offset - -default_limit}`);
        return { previous, next, default_limit, default_offset };
      } else {
        if (url.includes("?")) {
          next = url + `limit=${default_limit}&offset=${default_offset - -default_limit}`;
          return { previous, next, default_limit, default_offset };
        } else {
          next = url + `?limit=${default_limit}&offset=${default_offset - -default_limit}`;
          return { previous, next, default_limit, default_offset };
        }
      }
    } else if (current_page === total_page && total_page > 1) {
      previous = url.replace(regex, `limit=${default_limit}&offset=${default_offset - default_limit}`);
      return { previous, next, default_limit, default_offset };
    } else if (current_page > 1 && current_page < total_page) {
      previous = url.replace(regex, `limit=${default_limit}&offset=${default_offset - default_limit}`);
      next = url.replace(regex, `limit=${default_limit}&offset=${default_offset - -default_limit}`);
      return { previous, next, default_limit, default_offset };
    }
    // Fallback - shouldn't hit here but satisfies exhaustive return
    return { previous, next, default_limit, default_offset };
  }

  /**
   * Retrieve the User list in a paginated format.
   *   1. Count: the number of users found.
   *   2. Next: if there are additional users that couldn't be shown in the current page, then the link to the next page is shown.
   *               For example: if there are 20 users in total, and the current page is showing only 10 users, then the 'next' property is going to give the
   *               link to the 2nd page that can show the users with an ID of 11 to 20.
   *   3. Previous: if the offset is set, then some of the initial users will be skipped automatically. The 'previous' property provides a link to view
   *                   these skipped users. For example: if there are 20 users and the limit = 5 and the offset = 5, then the current page will show users with
   *                   an ID of 6 to 10 and skip the first 5 users. The 'previous' property in this case will provide the link for the 1st page that can show
   *                   the first 5 users.
   *   4. Result: provides the users list. The 'result' property follows the limit and offset values to decide which users are going to be showed.
   * @param url - Original request URL. See {@link https://expressjs.com/en/api.html#req.originalUrl}
   * @param limit - How many results can be seen at once
   * @param offset - How many initial results will be skipped
   * @param role - The role of the user
   * @returns List of all users
   */
  async getUsersList(url: string, limit?: number, offset?: number, role?: string): Promise<PaginationDto> {
    let paths: { previous: string | null; next: string | null; default_limit: number; default_offset: number };
    let result: unknown[];
    const filters: Record<string, unknown> = {}; // Initialize filters as empty object

    if (role) {
      filters.roles = { $in: [role] }; // Set role in permissions if provided
    }
    const count = await this.userModel.countDocuments({ ...filters });
    if (limit && offset) {
      paths = this.pagination(count, url, limit, offset);
      result = (await this.userModel
        .find({ ...filters })
        .skip(paths.default_offset)
        .limit(paths.default_limit)) as unknown[];
    } else {
      paths = this.pagination(count, url);
      result = (await this.userModel.find({ ...filters }).limit(paths.default_limit)) as unknown[];
    }
    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result,
    };
  }

  /**
   * Return a user with a particular id.
   *
   * @param user_id - Id of the user to find
   */
  async getUserById(user_id: string): Promise<User> {
    return this.userModel.findOne({ id: Number(user_id) });
  }

  /**
   * Create a new user with additional defaulted properties:
   *   1. The password is encrypted using the 'argon2id' method.
   *   2. The UserID is generated in an incremental order using getNextUserValue() function.
   *   3. The name of the user is saved by simply joining the first and last names of the user.
   *   4. The 'recently_accessed' object contains a list of all the Models created by the user. By default its kept empty at first.
   *      The Projects and Subsystems have not been implemented yet. Whenever the user creates any new HCL tree inside a Model,
   *      the tree's info gets saved inside this Model list. After creating a tree, if it is viewed, edited or quantified - those
   *      information get saved as well - to get an idea about the activity of the user.
   *   5. Whenever a user is interacting with the tree editor, the user can enable or disable certain settings of the editor. Those settings
   *      are saved in the 'preferences' object. By default all the settings inside the 'preferences' are set to 'enabled' when a user is created.
   *   6. The permissions feature has not been implemented yet - so it is kept empty by default. Once implemented, a user will be able to assume
   *      one of the two roles - either the role of an administrator (with special access - such as deleting a user from the database) or the role of a general user.
   * @param body - Request body
   * @returns A mongoose document of the new user
   */
  async createNewUser(body: CreateNewUserSchemaDto): Promise<User | string> {
    const username = body.username;
    const email = body.email;
    const response1 = await this.userModel.findOne({
      username: username,
    });
    const response2 = await this.userModel.findOne({
      email: email,
    });
    if (response1) {
      return "username already exists";
    }
    if (response2) {
      return "email already exists";
    }
    body.password = await argon2.hash(body.password);
    const newUser = new this.userModel(body);
    newUser.id = await this.getNextUserValue("UserCounter");
    newUser.recently_accessed = {
      models: [],
      subsystems: [],
      projects: [],
    };
    newUser.preferences = {
      theme: "Light",
      nodeIdsVisible: true,
      outlineVisible: true,
      node_value_visible: true,
      nodeDescriptionEnabled: true,
      pageBreaksVisible: true,
      quantificationConfigurations: {
        configurations: {},
        currentlySelected: " ",
      },
    };
    newUser.roles = body.roles ?? [];
    return newUser.save();
  }

  /**
   * Return true if email exists in the database.
   *
   * @param email - Email of the user
   */
  async isEmailValid(email: string): Promise<boolean> {
    const response = await this.userModel.findOne({
      email: email,
    });
    return !response;
  }

  /**
   * Return true if username exists in the database.
   *
   * @param username - Username of the user
   */
  async isUsernameValid(username: string): Promise<boolean> {
    const response = await this.userModel.findOne({
      username: username,
    });
    return !response;
  }

  /**
   * Get preferences for the current user.
   *
   * @param user_id - Current user's ID
   * @returns Preferences of the current user
   */
  async getUserPreferences(user_id: string) {
    return this.userModel.findOne({ id: Number(user_id) }, { preferences: 1 });
  }

  /**
   * 1. The lean() method returns a Plain Old JS Object (POJO) instead of a Mongoose document which makes the query much faster.
   * 2. Since the 'preferences' is a nested object, 2 things are needed to be done to ensure that its properties are updated properly:
   *    a. Use the objectID (_id) of the User document instead of using normal UserID(id) inside the findByIdAndUpdate() query method.
   *    b. Use 'dot-object' library to break-down the nested object properties. For example dot-object is going to transform:
   *
   * ```json
   * {
   *   "preferences": {
   *     "theme": "Light",
   *     "outlineVisible": false
   *   }
   * }
   * ```
   *
   *    into:
   *
   * ```ts
   * { 'preferences.theme': 'Light', 'preferences.outlineVisible': false }
   * ```
   *
   *    Without using dot-object all the 6 preference settings are going to be replaced by these 2 properties only, deleting the rest of the 4 settings.
   * 3. '$set' operator replaces a field's value with the provided value.
   * 4. 'new' is set to true to ensure that the document that is returned after saving the preferences is always the updated one.
   * 5. 'upsert' is a combined action of 'Update and insert'. If a user is not found while updating the preferences with the given UserID,
   *    the upsert operation will create a new user document with the given preferences which is not desired. So the upsert is set to false.
   * @param user_id - Current user's ID
   * @param body - Request body
   * @returns Updated preferences of the user
   */
  async updateUserPreferences(user_id: string, body: UserPreferencesDto) {
    const user = (await this.userModel.findOne({ id: Number(user_id) }).lean()) as { _id: unknown };
    return this.userModel.findByIdAndUpdate(
      user._id,
      { $set: dot.dot(body) as unknown as Record<string, unknown> },
      { projection: { preferences: 1 }, new: true, upsert: false },
    );
  }

  /**
   * This is a general update user function. It will allow the following updates: preferences, permissions, lastname, email, firstname, and username
   * @param member - This is the user schema object
   */
  async updateUser(member: MemberResult): Promise<void> {
    const user: Partial<User> = {};
    user.id = member.id;
    user.email = member.email;
    user.firstName = member.firstName;
    user.lastName = member.lastName;
    user.username = member.username;
    if (member.preferences && typeof member.preferences === "object") {
      user.preferences = member.preferences as unknown as User["preferences"];
    }
    if (Array.isArray(member.roles)) {
      user.roles = member.roles as unknown as User["roles"];
    }
    if (member.password !== undefined) {
      user.password = await argon2.hash(member.password);
    }
    await this.userModel.updateOne({ id: user.id }, user, {
      upsert: false,
    });
  }
}
