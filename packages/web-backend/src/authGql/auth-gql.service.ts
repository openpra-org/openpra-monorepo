import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { UsersService } from "../users/users.service";
import { ClientUser } from "../users/entities/clientUser.entity";
import { LoginUserInput } from "./dto/login-user.input";
import { LoginResponse } from "./dto/login-response";

/**
 * @public Business logic for the GraphQl implementation of the Auth service.
 * */
@Injectable()
export class AuthGqlService {
  /**
   * @remarks Constructs an AuthGqlService object to handle validation, login and signup.
   * @param usersService - Contains business logic to create, read, update and delete users.
   * @param jwtService - Module provided by Nest.js to sign and validate tokens.
   * */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * @remarks Checks for user with username obtained from client and compares provided passwords.
   * @param username - Username provided by the client.
   * @param password - Password provided by the client.
   * @returns ClientUser object containing ID and username if user exists and passwords match, undefined otherwise.
   * */
  async validateUser(username: string, password: string): Promise<ClientUser | undefined> {
    const user = await this.usersService.findOne(username);

    if (user !== null) {
      const valid: boolean = await argon2.verify(user.password, password);
      if (valid) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * @remarks Handles JWT generation for authenticated user.
   * @param user - ClientUser object provided by validateUser.
   * @returns LoginResponse object containing the generated JWT and user.
   * */
  login(user: ClientUser): LoginResponse {
    return {
      access_token: this.jwtService.sign({
        username: user.username,
        sub: user._id,
      }),
      user: user,
    };
  }

  /**
   * @remarks Creates a new user if the provided username does not exist already in the database.
   * @param loginUserInput - LoginUserInput object containing the username and password from the client.
   * @returns ClientUser object if user does not exist and new user was created successfully.
   * */
  async signup(loginUserInput: LoginUserInput): Promise<ClientUser> {
    const user = await this.usersService.findOne(loginUserInput.username);

    if (user !== null) {
      throw new Error("User already exists");
    }
    const password: string = await argon2.hash(loginUserInput.password);
    return this.usersService.create({
      ...loginUserInput,
      password,
    });
  }
}
