import { Test, TestingModule } from "@nestjs/testing";
import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { CollabService } from "../collab/collab.service";
import { User, UserSchema } from "../collab/schemas/user.schema";
import {
  UserCounter,
  UserCounterSchema,
} from "../collab/schemas/user-counter.schema";
import { AuthService } from "./auth.service";
import { expect } from "@playwright/test";

describe("AuthService", () => {
  let authService: AuthService;
  let collabService: CollabService;
  let connection: Connection;

  /**
   * Before any test is run, start a new in-memory MongoDB instance and connect to it.
   * Create a new module with the AuthService and CollabService.
   * make connection object and authService and collabService available to all tests.
   */
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI; //get the URI from the environment variable
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: UserCounter.name, schema: UserCounterSchema },
        ]),
      ],
      providers: [AuthService, CollabService, JwtService],
    }).compile();
    authService = module.get<AuthService>(AuthService);
    collabService = module.get<CollabService>(CollabService);
    connection = await module.get(getConnectionToken());
  });

  afterEach(async () => {
    await connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  describe("AuthService", () => {
    it("AuthService should be defined", async () => {
      expect(authService).toBeDefined();
    });
  });

  describe("loginUser", () => {
    it("should be defined", () => {
      expect(authService.loginUser).toBeDefined();
    });

    /**
     * define a user object and create a new user
     * store correct password in a variable
     * should process login with correct password
     * expect result to be an instance of User
     */
    it("should process login with correct password", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const correctPassword = user_object.password;
      const response = await collabService.createNewUser(user_object); // create a new user
      const result = await authService.loginUser(
        user_object.username,
        correctPassword,
      ); // call loginUser function
      expect(result).toBeInstanceOf(Object); //expect result to be an instance of User
    });

    /**
     * define a user object and create a new user
     * store incorrect password in a variable
     * should fail login with incorrect password
     * expect result to be an instance of Error
     */
    it("should fail login with incorrect password", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const incorrectPassword = "123";
      await collabService.createNewUser(user_object); // create a new user
      try {
        await authService.loginUser(user_object.username, incorrectPassword); // call loginUser function
      } catch (err) {
        expect(err).toBeInstanceOf(Error); //expect result to be an instance of User
      }
    });

    /**
     * define a user object and create a new user
     * store incorrect username in a variable
     * should fail login with incorrect username
     * expect result to be an instance of Error
     */
    it("should fail login with incorrect username", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const incorrectUsername = "testUserABCD";
      await collabService.createNewUser(user_object); // create a new user
      try {
        await authService.loginUser(incorrectUsername, user_object.password); // call loginUser function
      } catch (err) {
        expect(err).toBeInstanceOf(Error); //expect result to be an instance of User
      }
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      const userObject = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      await collabService.createNewUser(userObject); // create a new user
      const correctPassword = "12345678";
      const passwordMatch = await authService.verifyPassword(
        userObject.username,
        correctPassword,
      );
      expect(passwordMatch).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const userObject = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      await collabService.createNewUser(userObject); // create a new user
      const correctPassword = "1234568";
      const passwordMatch = await authService.verifyPassword(
        userObject.username,
        correctPassword,
      );
      expect(passwordMatch).toBe(false);
    });
  });
});
