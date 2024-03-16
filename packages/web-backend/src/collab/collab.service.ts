import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as argon2 from "argon2";
import * as dot from "dot-object";
import { UpdateOneModel } from "mongodb";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { PaginationDto } from "./dtos/pagination.dto";
import { CreateNewUserDto } from "./dtos/create-new-user.dto";
import { UserPreferencesDto } from "./dtos/user-preferences.dto";
import {
  UserCounter,
  UserCounterDocument,
} from "./schemas/user-counter.schema";
import { User, UserDocument } from "./schemas/user.schema";
import {UserSideNavPreferences, UserSideNavTabsDocument} from "../typedModel/schemas/side-nav-tabs.schema";
import {SIDE_NAV_DATA} from "./sideNavData";

@Injectable()
export class CollabService {
  constructor(
    //private hclService: HclService,
    @InjectModel(UserCounter.name)
    private readonly userCounterModel: Model<UserCounterDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserSideNavPreferences.name) private readonly userSideNavModel: Model<UserSideNavTabsDocument>
  ) {}

  /**
   * @param {string} username
   * @description
   * Assists the Local Strategy method to ensure whether a user exists in the database or not.
   * @returns A mongoose document of the user | undefined
   */
  async loginUser(username: string): Promise<User | undefined> {
    return this.userModel.findOne({ username }).lean();
  }

  /**
   * @param {number} user_id Current user's ID
   * @description
   * After each login, the last login time of the user is updated.
   * @returns void
   */
  async updateLastLogin(user_id: number) {
    await this.userModel.updateOne({ id: user_id }, { last_login: Date.now() });
  }

  /**
   * @param {string} name Name of the counter
   * @description
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
   * @returns {number} ID number
   */
  async getNextUserValue(name: string) {
    const record = await this.userCounterModel.findByIdAndUpdate(
      name,
      { $inc: { seq: 1 } },
      { new: true },
    );
    if (!record) {
      const newCounter = new this.userCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  /**
   * @param {number} count Total number of results
   * @param {string} url Original request URL {@link https://expressjs.com/en/api.html#req.originalUrl}
   * @param limit How many results can be seen at once
   * @param offset How many initial results will be skipped
   * @description
   * The pagination() method follows a very simple mechanism:
   *   1. It determines the number of pages its going to take to show all the queried results.
   *   2. It determines on which page the user is currently on.
   * These 2 parameters are calculated using 3 information: limit, offset and total number of results (count).
   * By default the limit = 10 and offset = 0. But if the user provides different values for these parameters, then the provided values replace the default ones.
   * Let's look at an example: let's say there are 35 users in the database. The current user is trying to see the list of users. The user set the
   * limit to 5 and offset to 10.
   * So, the number of pages its going to take to show all the users = (number of users / users per page) = (35 / 5) = 7 pages
   * And the page on which the user will be on = (skipped users / users per page) + 1 = (10 / 5) + 1 = 3
   * After determining these 2 data, the method will 4 situations:
   *   1. There's only 1 page in total where all the results fit; in that case there will be no previous or next page link.
   *   2. There's more than 1 page in total but the user is on the first result page; in that case - link for the next page will be available only.
   *   3. There's more than 1 page in total but the user is on the last result page; in that case - link for the previous page will be available only.
   *   4. There's more than 1 page in total and the user is somewhere between the first and last page; in that case links for both previous and next page will be available.
   * The 4th condition suits the above example. The user is in the 3rd page which is between the first page and the last (7 number) page. The pagination() method
   * will provide the links to the 2nd (previous) and 4th (next) pages to the user.
   * @returns 1. The links to previous and next result pages, 2. limit and offset values
   */
  pagination(count: number, url: string, limit?: any, offset?: any) {
    let previous = null;
    let next = null;
    const regex = /limit=[A-Za-z0-9]+&offset=[A-Za-z0-9]+/i;

    let default_limit = 10;
    let default_offset = 0;
    if (limit && offset) {
      if (!isNaN(limit)) {
        default_limit = Number(limit);
      }
      if (!isNaN(offset)) {
        default_offset = Number(offset);
      }
    }

    const total_page = Math.ceil(count / default_limit);
    const current_page = default_offset / default_limit + 1;

    if (total_page <= 1) {
      return { previous, next, default_limit, default_offset };
    } else if (current_page === 1 && total_page > 1) {
      if (url.includes("limit")) {
        next = url.replace(
          regex,
          `limit=${default_limit}&offset=${default_offset - -default_limit}`,
        );
        return { previous, next, default_limit, default_offset };
      } else {
        if (url.includes("?")) {
          next =
            url +
            `limit=${default_limit}&offset=${default_offset - -default_limit}`;
          return { previous, next, default_limit, default_offset };
        } else {
          next =
            url +
            `?limit=${default_limit}&offset=${default_offset - -default_limit}`;
          return { previous, next, default_limit, default_offset };
        }
      }
    } else if (current_page === total_page && total_page > 1) {
      previous = url.replace(
        regex,
        `limit=${default_limit}&offset=${default_offset - default_limit}`,
      );
      return { previous, next, default_limit, default_offset };
    } else if (current_page > 1 && current_page < total_page) {
      previous = url.replace(
        regex,
        `limit=${default_limit}&offset=${default_offset - default_limit}`,
      );
      next = url.replace(
        regex,
        `limit=${default_limit}&offset=${default_offset - -default_limit}`,
      );
      return { previous, next, default_limit, default_offset };
    }
  }

  /**
   * @param {string} url Original request URL {@link https://expressjs.com/en/api.html#req.originalUrl}
   * @param limit How many results can be seen at once
   * @param offset How many initial results will be skipped
   * @description
   * No parameter is needed to retrieve the User list. The retrieved data is presented in a 'paginated' format:
   *   1. Count: the number of users found.
   *   2. Next: if there are additional users that couldn't be shown in the current page, then the link to the next page is shown.
   *               For example: if there are 20 users in total, and the current page is showing only 10 users, then the 'next' property is going to give the
   *               link to the 2nd page that can show the users with an ID of 11 to 20.
   *   3. Previous: if the offset is set, then some of the initial users will be skipped automatically. The 'previous' property provides a link to view
   *                   these skipped users. For example: if there are 20 users and the limit = 5 and the offset = 5, then the current page will show users with
   *                   an ID of 6 to 10 and skip the first 5 users. The 'previous' property in this case will provide the link for the 1st page that can show
   *                   the first 5 users.
   *   4. Result: provides the users list. The 'result' property follows the limit and offset values to decide which users are going to be showed.
   * @returns List of all users
   */
  async getUsersList(
    url: string,
    limit?: any,
    offset?: any,
  ): Promise<PaginationDto> {
    let paths = undefined;
    let result = undefined;
    const count = await this.userModel.countDocuments();
    if (limit && offset) {
      paths = this.pagination(count, url, limit, offset);
      result = await this.userModel
        .find()
        .skip(paths.default_offset)
        .limit(paths.default_limit);
    } else {
      paths = this.pagination(count, url);
      result = await this.userModel.find().limit(paths.default_limit);
    }
    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result,
    };
  }

  /**
   *
   * This function returns a user with a particular id
   * @param user_id - Id of the user you want to find
   */
  async getUserById(user_id: string): Promise<User> {
    return this.userModel.findOne({ id: Number(user_id) });
  }

  /**
   * @param body Request body
   * @description
   * There are some hard-coded data provided alongside the request body for creating a 'user' document:
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
   * @returns A mongoose document of the new user
   */
  async createNewUser(body: CreateNewUserDto): Promise<User | string> {
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
    //Add sidebar tabs for the user with each new signup
    await this.userSideNavModel.create({
      user: username,
      preferences: SIDE_NAV_DATA,
    });
    return newUser.save();
  }

  /**
   * @param {string} user_id Current user's ID
   * @description
   * UserID is provided as the Query filter. To show only the preferences, inside the projection option the 'preferences' is set to 1
   * (1 for true, 0 for false).
   * @returns Preferences of the current user
   */
  async getUserPreferences(user_id: string) {
    return this.userModel.findOne({ id: Number(user_id) }, { preferences: 1 });
  }

  /**
   * @param {string} user_id Current user's ID
   * @param body Request body
   * @description
   * 1. The lean() method returns a Plain Old JS Object (POJO) instead of a Mongoose document which makes the query much faster.
   * 2. Since the 'preferences' is a nested object, 2 things are needed to be done to ensure that its properties are updated properly:
   *    a. Use the objectID (_id) of the User document instead of using normal UserID(id) inside the findByIdAndUpdate() query method.
   *    b. Use 'dot-object' library to break-down the nested object properties. For example dot-object is going to transform:
   *    {
   *      "preferences":
   *        {
   *          "theme": "Light",
   *          "outlineVisible": false,
   *        }
   *    }
   *    into: { 'preferences.theme': light, 'preferences.outlineVisible': false }.
   *    Without using dot-object all the 6 preference settings are going to be replaced by these 2 properties only, deleting the rest of the 4 settings.
   * 3. '$set' operator replaces a field's value with the provided value.
   * 4. 'new' is set to true to ensure that the document that is returned after saving the preferences is always the updated one.
   * 5. 'upsert' is a combined action of 'Update and insert'. If a user is not found while updating the preferences with the given UserID,
   *    the upsert operation will create a new user document with the given preferences which is not desired. So the upsert is set to false.
   * @returns Updated preferences of the user
   */
  async updateUserPreferences(user_id: string, body: UserPreferencesDto) {
    const user = await this.userModel.findOne({ id: Number(user_id) }).lean();
    return this.userModel.findByIdAndUpdate(
      user._id,
      { $set: dot.dot(body) },
      { projection: { preferences: 1 }, new: true, upsert: false },
    );
  }

  /**
   * This is a general update user function. It will allow the following updates: preferences, permissions, lastname, email, firstname, and username
   * @param member - This is the user schema object
   */
  async updateUser(member: MemberResult): Promise<UpdateOneModel> {
    const user = new User();
    user.id = member.id;
    user.email = member.email;
    user.firstName = member.firstName;
    user.lastName = member.lastName;
    user.username = member.username;
    user.preferences = member.preferences;
    user.permissions = member.permissions;
    if (member.password !== undefined) {
      user.password = await argon2.hash(member.password);
    }
    return this.userModel
      .updateOne({ id: user.id }, user, {
        projection: {
          preferences: 1,
          permissions: 1,
          lastName: 1,
          email: 1,
          firstName: 1,
          username: 1,
          password: 1,
        },
        new: true,
        upsert: false,
      })
      .lean();
  }
}
