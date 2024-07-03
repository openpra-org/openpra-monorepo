import { Injectable } from "@nestjs/common";
import { CreateUserInput } from "./dto/create-user.input";
import { User } from "./entities/user.entity";

/**
 * @public Business logic for CRUD operations on users.
 * */
@Injectable()
export class UsersService {
  private readonly users = [
    {
      id: 1,
      username: "demo",
      password: "demo",
    },
    {
      id: 2,
      username: "demo2",
      password: "demo2",
    },
  ];

  /**
   * @remarks Creates a new user based on the provided username and password.
   * @param createUserInput - InputType object containing the username and password.
   * @returns Created User object.
   * */
  create(createUserInput: CreateUserInput): User {
    const user = {
      ...createUserInput,
      id: this.users.length + 1,
    };
    this.users.push(user);

    return user;
  }

  /**
   * @remarks Returns all the users present in the DB.
   * @returns An array of User objects if users exist. Undefined otherwise.
   * */
  findAll(): User[] | undefined {
    return this.users;
  }

  /**
   * @remarks Returns User object having the same username as provided by the client.
   * @param username - Username provided by the client.
   * @returns User object if user with given username exists. Undefined otherwise
   * */
  findOne(username: string): User | undefined {
    return this.users.find((user) => user.username === username);
  }
}
