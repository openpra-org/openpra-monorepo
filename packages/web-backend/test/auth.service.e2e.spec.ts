import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { CollabService } from "../src/collab/collab.service";
import { AuthService } from "../src/auth/auth.service";
import { User, UserSchema } from "../src/collab/schemas/user.schema";
import {
  UserCounter,
  UserCounterSchema,
} from "../src/collab/schemas/user-counter.schema";

describe("AuthService", () => {
  let authService: AuthService;
  let connection: Connection;
  let collabService: CollabService;
  const DB_URI = "mongodb://localhost/27017";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(DB_URI),
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
    await connection
      .collection("users")
      .findOneAndDelete({ username: "testUser" }); //delete test user before each test
  });

  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  afterEach(async () => {
    //delete test user after each test
    await connection
      .collection("users")
      .findOneAndDelete({ username: "testUser" });
  });

  describe("AuthService", () => {
    it("AuthService should be defined", async () => {
      expect(AuthService).toBeDefined();
    });
  });

  describe("loginUser", () => {
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

    it("should fail login with incorrect password", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const incorrectPassword = "123";
      const response = await collabService.createNewUser(user_object); // create a new user
      try {
        const result = await authService.loginUser(
          user_object.username,
          incorrectPassword,
        ); // call loginUser function
      } catch (err) {
        expect(err).toBeInstanceOf(Error); //expect result to be an instance of User
      }
    });

    it("should fail login with incorrect username", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const incorrectUsername = "testUserABCD";
      const response = await collabService.createNewUser(user_object); // create a new user
      try {
        const result = await authService.loginUser(
          incorrectUsername,
          user_object.password,
        ); // call loginUser function
      } catch (err) {
        expect(err).toBeInstanceOf(Error); //expect result to be an instance of User
      }
    });
  });
});
