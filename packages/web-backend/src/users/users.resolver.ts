import { Resolver, Query, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../authGql/jwt-auth.guard";
import { UsersService } from "./users.service";
import { UserType } from "./entities/user.entity";
import { ClientUser } from "./entities/clientUser.entity";

/**
 * @public Resolver class that handles queries pertaining to users.
 * */
@Resolver(() => UserType)
export class UsersResolver {
  /**
   * @remarks Constructs a UsersResolver object to find users.
   * @param usersService - Contains business logic to create, read, update and delete users.
   * */
  constructor(private readonly usersService: UsersService) {}

  /**
   * @remarks Returns all the users present in the DB. JwtAuthGuard ensures this route is accessible ot users with valid JWT.
   * @returns An array of User objects if users exist. Undefined otherwise.
   * */
  @Query(() => [ClientUser], { name: "users" })
  @UseGuards(JwtAuthGuard)
  async findAll(): Promise<ClientUser[]> {
    return this.usersService.findAll();
  }

  /**
   * @remarks Returns User object having the same username as provided by the client.
   * @param username - Username provided by the client.
   * @returns User object if user with given username exists. Undefined otherwise
   * */
  @Query(() => UserType, { name: "user" })
  async findOne(@Args("username") username: string): Promise<UserType> {
    return this.usersService.findOne(username);
  }
}
