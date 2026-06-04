import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as argon2 from "argon2";
import * as dot from "dot-object";
import { MemberResult } from "shared-sdk";
import { CreateNewUserSchemaDto } from "./dtos/createNewUser-schema";
import { PaginationDto } from "./dtos/pagination.dto";
import { UserPreferencesDto } from "./dtos/user-preferences.dto";
import { UserCounter, UserCounterDocument } from "./schemas/user-counter.schema";
import { User, UserDocument } from "./schemas/user.schema";
@Injectable()
export class CollabService {
  constructor(
    @InjectModel(UserCounter.name)
    private readonly userCounterModel: Model<UserCounterDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}
  async loginUser(username: string): Promise<User | undefined> {
    return this.userModel.findOne({ username }).lean();
  }
  async updateLastLogin(user_id: number): Promise<void> {
    await this.userModel.updateOne({ id: user_id }, { last_login: Date.now() });
  }
  async getNextUserValue(name: string): Promise<number> {
    const record = await this.userCounterModel.findByIdAndUpdate(
      name,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return record.seq;
  }
  pagination(
    count: number,
    url: string,
    limit?: unknown,
    offset?: unknown,
  ): {
    previous: string | null;
    next: string | null;
    default_limit: number;
    default_offset: number;
  } {
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
    return { previous, next, default_limit, default_offset };
  }
  async getUsersList(url: string, limit?: number, offset?: number, role?: string): Promise<PaginationDto> {
    let paths: {
      previous: string | null;
      next: string | null;
      default_limit: number;
      default_offset: number;
    };
    let result: unknown[];
    const filters: Record<string, unknown> = {};
    if (role) {
      filters.roles = { $in: [role] };
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
  async getUserById(user_id: string): Promise<User> {
    return this.userModel.findOne({ id: Number(user_id) });
  }
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
  async isEmailValid(email: string): Promise<boolean> {
    const response = await this.userModel.findOne({
      email: email,
    });
    return !response;
  }
  async isUsernameValid(username: string): Promise<boolean> {
    const response = await this.userModel.findOne({
      username: username,
    });
    return !response;
  }
  async getUserPreferences(user_id: string) {
    return this.userModel.findOne({ id: Number(user_id) }, { preferences: 1 });
  }
  async updateUserPreferences(user_id: string, body: UserPreferencesDto) {
    const user = (await this.userModel.findOne({ id: Number(user_id) }).lean()) as {
      _id: unknown;
    };
    return this.userModel.findByIdAndUpdate(
      user._id,
      { $set: dot.dot(body) as unknown as Record<string, unknown> },
      { projection: { preferences: 1 }, new: true, upsert: false },
    );
  }
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
