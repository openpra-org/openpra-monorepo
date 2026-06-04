import { Test, TestingModule } from "@nestjs/testing";
import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { expect } from "@playwright/test";
import { CollabService } from "../collab/collab.service";
import { User, UserSchema } from "../collab/schemas/user.schema";
import { UserCounter, UserCounterSchema } from "../collab/schemas/user-counter.schema";
import { AuthService } from "./auth.service";
import { CreateNewUserSchemaDto } from "../collab/dtos/createNewUser-schema";
describe("AuthService", () => {
  let authService: AuthService;
  let collabService: CollabService;
  let connection: Connection;
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI;
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
    await mongoose.disconnect();
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
    it("should process login with correct password", async () => {
      const user_object: CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      const correctPassword = user_object.password;
      const _response = await collabService.createNewUser(user_object);
      const result = await authService.loginUser(user_object.username, correctPassword);
      expect(result).toBeInstanceOf(Object);
    });
    it("should fail login with incorrect password", async () => {
      const user_object: CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      const incorrectPassword = "123";
      await collabService.createNewUser(user_object);
      try {
        await authService.loginUser(user_object.username, incorrectPassword);
      } catch (_err: unknown) {
        expect(_err).toBeInstanceOf(Error);
      }
    });
    it("should fail login with incorrect username", async () => {
      const user_object: CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      const incorrectUsername = "testUserABCD";
      await collabService.createNewUser(user_object);
      try {
        await authService.loginUser(incorrectUsername, user_object.password);
      } catch (_err: unknown) {
        expect(_err).toBeInstanceOf(Error);
      }
    });
  });
  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      const userObject: CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      await collabService.createNewUser(userObject);
      const correctPassword = "12345678";
      const passwordMatch = await authService.verifyPassword(userObject.username, correctPassword);
      expect(passwordMatch).toBe(true);
    });
    it("should return false for incorrect password", async () => {
      const userObject: CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      await collabService.createNewUser(userObject);
      const correctPassword = "1234568";
      const passwordMatch = await authService.verifyPassword(userObject.username, correctPassword);
      expect(passwordMatch).toBe(false);
    });
  });
});
