import { Resolver, Query, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../authGql/jwt-auth.guard";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User], { name: "users" })
  @UseGuards(JwtAuthGuard)
  findAll(): User[] | undefined {
    return this.usersService.findAll();
  }

  @Query(() => User, { name: "user" })
  findOne(@Args("username") username: string): User | undefined {
    return this.usersService.findOne(username);
  }
}
