import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import { CollabService } from "../src/collab/collab.service";
import { User, UserSchema } from "../src/collab/schemas/user.schema";
import { UserCounter, UserCounterSchema } from "../src/collab/schemas/user-counter.schema";
describe("CollabService", () => {
  let collabService: CollabService;
  let connection: Connection;
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
      providers: [CollabService],
    }).compile();
    connection = await module.get(getConnectionToken());
    collabService = module.get<CollabService>(CollabService);
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  afterEach(async () => {
    await connection.collection("users").findOneAndDelete({ username: "testUser" });
  });
  describe("CollabService", () => {
    it("CollabService should be defined", async () => {
      expect(collabService).toBeDefined();
    });
  });
  describe("createNewUser", () => {
    it("should create user", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabService.createNewUser(user_object);
      expect(response).toBeDefined();
    });
    it("should fail on duplicate username", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const _response = await collabService.createNewUser(user_object);
      try {
        const _returnedValue = await collabService.createNewUser(user_object);
      } catch (_err: unknown) {
        expect(_err).toBeInstanceOf(Error);
      }
    });
  });
  describe("loginUser", () => {
    it("should return null if user does not exist", async () => {
      const username = "randomUserXYZ";
      const result = await collabService.loginUser(username);
      expect(result).toBeNull();
    });
    it("should return user document if user logged in successfully", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const _response = await collabService.createNewUser(user_object);
      const result = await collabService.loginUser(user_object.username);
      expect(result).toBeDefined();
    });
  });
  describe("getUserPreferences", () => {
    it("should return user preferences", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabService.createNewUser(user_object);
      if (typeof response !== "string") {
        const returnedValue = await collabService.getUserPreferences(String(response.id));
        expect(returnedValue).toBeDefined();
      }
    });
  });
  describe("updateUserPreferences", () => {
    it("should update user preferences - theme", async () => {
      const userPreferenceObject = { preferences: { theme: "Dark" } };
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabService.createNewUser(user_object);
      if (typeof response !== "string") {
        const returnedValue = await collabService.updateUserPreferences(String(response.id), userPreferenceObject);
        expect(returnedValue.preferences.theme).toMatch("Dark");
      }
    });
    it("should update user preferences - nodeIdsVisible", async () => {
      const userPreferenceObject = { preferences: { nodeIdsVisible: false } };
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabService.createNewUser(user_object);
      if (typeof response !== "string") {
        const returnedValue = await collabService.updateUserPreferences(String(response.id), userPreferenceObject);
        expect(returnedValue.preferences.nodeIdsVisible).toBeFalsy();
      }
    });
    it("should update user preferences - outlineVisible", async () => {
      const userPreferenceObject = { preferences: { outlineVisible: false } };
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabService.createNewUser(user_object);
      if (typeof response !== "string") {
        const returnedValue = await collabService.updateUserPreferences(String(response.id), userPreferenceObject);
        expect(returnedValue.preferences.outlineVisible).toBeFalsy();
      }
    });
  });
  describe("updateLastLogin", () => {
    it("should update last login", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabService.createNewUser(user_object);
      const dateBefore = Date.now();
      if (typeof response !== "string") {
        await collabService.updateLastLogin(response.id);
        const returnedValue = await collabService.loginUser(user_object.username);
        const dateNumber = returnedValue.last_login.getTime();
        expect(dateNumber).toBeGreaterThanOrEqual(dateBefore);
      }
    });
  });
});
