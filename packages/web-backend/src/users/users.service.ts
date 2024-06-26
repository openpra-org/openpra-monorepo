import { Injectable } from "@nestjs/common";
import { CreateUserInput } from "./dto/create-user.input";
import { User } from "./entities/user.entity";

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

  create(createUserInput: CreateUserInput): User {
    const user = {
      ...createUserInput,
      id: this.users.length + 1,
    };
    this.users.push(user);

    return user;
  }

  findAll(): User[] | undefined {
    return this.users;
  }

  findOne(username: string): User | undefined {
    return this.users.find((user) => user.username === username);
  }
}
