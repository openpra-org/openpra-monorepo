import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { CollabService } from "../src/collab/collab.service";
import { AuthService } from "../src/auth/auth.service";
import { User, UserSchema } from "../src/collab/schemas/user.schema";
import { UserCounter, UserCounterSchema } from "../src/collab/schemas/user-counter.schema";

describe("AuthService", () => {
  let authService: AuthService;
  let connection: Connection;
  let collabService: CollabService;
  const DB_URI = "mongodb://localhost/27017";
  // Use a unique username/email per test file run to avoid collisions with other suites sharing the same DB
  let uniqueUsername: string;
  let uniqueEmail: string;

  beforeEach(async () => {
    uniqueUsername = `testUser_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    uniqueEmail = `${uniqueUsername}@example.com`;
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
    // delete any lingering user with our unique username (likely none on first run)
    await connection.collection("users").findOneAndDelete({ username: uniqueUsername });
  });

  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  afterEach(async () => {
    // delete the user we created during tests
    await connection.collection("users").findOneAndDelete({ username: uniqueUsername });
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
        email: uniqueEmail,
        username: uniqueUsername,
        password: "12345678",
      };
      const correctPassword = user_object.password;
        const _response = await collabService.createNewUser(user_object); // create a new user
      const result = await authService.loginUser(user_object.username, correctPassword); // call loginUser function
      expect(result).toBeInstanceOf(Object); //expect result to be an instance of User
    });

    it("should fail login with incorrect password", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: uniqueEmail,
        username: uniqueUsername,
        password: "12345678",
      };
      const incorrectPassword = "123";
        const _response2 = await collabService.createNewUser(user_object); // create a new user
      try {
        const _result = await authService.loginUser(user_object.username, incorrectPassword); // call loginUser function
      } catch (_err: unknown) {
        expect(_err).toBeInstanceOf(Error); //expect result to be an instance of User
      }
    });

    it("should fail login with incorrect username", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: uniqueEmail,
        username: uniqueUsername,
        password: "12345678",
      };
      const incorrectUsername = "testUserABCD";
        const _response3 = await collabService.createNewUser(user_object); // create a new user
      try {
        const _result = await authService.loginUser(incorrectUsername, user_object.password); // call loginUser function
      } catch (_err: unknown) {
        expect(_err).toBeInstanceOf(Error); //expect result to be an instance of User
      }
    });
  });
});
