import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import { UserType } from "./entities/user.entity";
import { CreateUserInput } from "./dto/create-user.input";
import { UserGql } from "./interfaces/users.interface";
import { ClientUser } from "./entities/clientUser.entity";

/**
 * @public Business logic for CRUD operations on users.
 * */
@Injectable()
export class UsersService {
  // private readonly users = [
  //   {
  //     id: 1,
  //     username: "demo",
  //     password: "demo",
  //   },
  //   {
  //     id: 2,
  //     username: "demo2",
  //     password: "demo2",
  //   },
  // ];
  constructor(@InjectModel("UserGql") private readonly userGqlModel: Model<UserGql>) {}

  /**
   * @remarks Creates a new user based on the provided username and password.
   * @param createUserInput - InputType object containing the username and password.
   * @returns Created User object.
   * */
  async create(createUserInput: CreateUserInput): Promise<UserType> {
    const newUser = new this.userGqlModel(createUserInput);
    return await newUser.save();
  }

  /**
   * @remarks Returns all the users present in the DB.
   * @returns An array of User objects if users exist. Undefined otherwise.
   * */
  async findAll(): Promise<ClientUser[]> {
    return await this.userGqlModel.find().exec();
  }

  /**
   * @remarks Returns User object having the same username as provided by the client.
   * @param username - Username provided by the client.
   * @returns User object if user with given username exists. Undefined otherwise
   * */
  async findOne(username: string): Promise<UserType> {
    return await this.userGqlModel.findOne({ username }).exec();
  }
}
